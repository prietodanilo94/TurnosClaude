"""
Builders de la funcion objetivo para el solver ILP (OR-Tools CP-SAT).
Cada termino agrega las variables auxiliares y constraints necesarias para
linealizar la formulacion de docs/math-formulation.md §4.
"""
from __future__ import annotations

from typing import Dict, Mapping, Tuple

from ortools.sat.python import cp_model

CoverageSlotKey = Tuple[str, int]
WorkerDayKey = Tuple[str, str]

WEEKEND_DAYS = {"sabado", "domingo"}


def _var_bounds(var: cp_model.IntVar) -> tuple[int, int]:
    domain = list(var.Proto().domain)
    return int(domain[0]), int(domain[-1])


def _safe_name(prefix: str, *parts: object) -> str:
    raw = "__".join([prefix, *[str(part) for part in parts]])
    return raw.replace("-", "_").replace(":", "_").replace(" ", "_")


def build_peak_coverage_term(
    model: cp_model.CpModel,
    coverage_by_slot: Mapping[CoverageSlotKey, cp_model.IntVar],
    peak_start_minute: int,
    coverage_cap: int,
) -> tuple[cp_model.LinearExpr, Dict[CoverageSlotKey, cp_model.IntVar]]:
    """
    Construye sum(min(c_{d,t}, coverage_cap)) para slots peak.
    """
    if coverage_cap < 0:
        raise ValueError("coverage_cap debe ser >= 0")

    capped_coverage: Dict[CoverageSlotKey, cp_model.IntVar] = {}
    terms: list[cp_model.IntVar] = []

    for key, coverage in coverage_by_slot.items():
        date_str, slot_minute = key
        if slot_minute < peak_start_minute:
            continue

        capped = model.NewIntVar(0, coverage_cap, _safe_name("peak_cap", date_str, slot_minute))
        model.Add(capped <= coverage)

        capped_coverage[key] = capped
        terms.append(capped)

    return cp_model.LinearExpr.Sum(terms), capped_coverage


def build_weekend_term(
    day_worked_by_worker: Mapping[WorkerDayKey, cp_model.IntVar],
    weekday_by_date: Mapping[str, str],
) -> cp_model.LinearExpr:
    """
    Construye sum(y_{w,d}) para sabados y domingos.
    """
    weekend_terms = [
        worked
        for (_, date_str), worked in day_worked_by_worker.items()
        if weekday_by_date.get(date_str) in WEEKEND_DAYS
    ]
    return cp_model.LinearExpr.Sum(weekend_terms)


def build_balance_term(
    model: cp_model.CpModel,
    worker_hours: Mapping[str, cp_model.IntVar],
    total_hours: cp_model.IntVar,
    num_workers: int,
) -> tuple[cp_model.LinearExpr, Dict[str, cp_model.IntVar]]:
    """
    Construye -sum(|H_w - H_prom|) usando la version escalada:
    |num_workers * H_w - total_hours|.
    """
    if num_workers <= 0:
        raise ValueError("num_workers debe ser mayor que 0")

    total_lb, total_ub = _var_bounds(total_hours)
    deviations: Dict[str, cp_model.IntVar] = {}
    penalties: list[cp_model.IntVar] = []

    for worker_rut, hours_var in worker_hours.items():
        hours_lb, hours_ub = _var_bounds(hours_var)
        max_scaled_dev = max(
            abs(num_workers * hours_lb - total_lb),
            abs(num_workers * hours_lb - total_ub),
            abs(num_workers * hours_ub - total_lb),
            abs(num_workers * hours_ub - total_ub),
        )

        deviation = model.NewIntVar(
            0,
            max_scaled_dev,
            _safe_name("balance_dev", worker_rut),
        )
        model.Add(deviation >= num_workers * hours_var - total_hours)
        model.Add(deviation >= total_hours - num_workers * hours_var)

        deviations[worker_rut] = deviation
        penalties.append(deviation)

    return -cp_model.LinearExpr.Sum(penalties), deviations


def build_idleness_term(
    model: cp_model.CpModel,
    coverage_by_slot: Mapping[CoverageSlotKey, cp_model.IntVar],
    desired_coverage_by_slot: Mapping[CoverageSlotKey, int],
    default_target: int = 1,
) -> tuple[
    cp_model.LinearExpr,
    Dict[CoverageSlotKey, cp_model.IntVar],
    Dict[CoverageSlotKey, cp_model.IntVar],
]:
    """
    Construye -sum(max(0, c_{d,t} - C*_{d,t})^2).
    """
    if default_target < 0:
        raise ValueError("default_target debe ser >= 0")

    excess_by_slot: Dict[CoverageSlotKey, cp_model.IntVar] = {}
    squared_excess_by_slot: Dict[CoverageSlotKey, cp_model.IntVar] = {}
    penalties: list[cp_model.IntVar] = []

    for key, coverage in coverage_by_slot.items():
        date_str, slot_minute = key
        target = desired_coverage_by_slot.get(key, default_target)
        if target < 0:
            raise ValueError("desired coverage no puede ser negativa")

        _, coverage_ub = _var_bounds(coverage)
        max_excess = max(0, coverage_ub - target)

        excess = model.NewIntVar(0, max_excess, _safe_name("idle_excess", date_str, slot_minute))
        squared_excess = model.NewIntVar(
            0,
            max_excess * max_excess,
            _safe_name("idle_excess_sq", date_str, slot_minute),
        )

        model.Add(excess >= coverage - target)
        model.AddMultiplicationEquality(squared_excess, [excess, excess])

        excess_by_slot[key] = excess
        squared_excess_by_slot[key] = squared_excess
        penalties.append(squared_excess)

    return -cp_model.LinearExpr.Sum(penalties), excess_by_slot, squared_excess_by_slot


def build_shift_type_balance_term(
    model: cp_model.CpModel,
    ape_counts: Mapping[str, cp_model.IntVar],
    cie_counts: Mapping[str, cp_model.IntVar]
) -> tuple[cp_model.LinearExpr, Dict[str, cp_model.IntVar]]:
    """
    Construye -sum(|count_APE(w) - count_CIE(w)|) para balancear
    turnos de apertura y cierre por trabajador.
    """
    penalties: list[cp_model.IntVar] = []
    differences: Dict[str, cp_model.IntVar] = {}

    for worker_rut in ape_counts.keys():
        ape_var = ape_counts[worker_rut]
        cie_var = cie_counts.get(worker_rut)
        if cie_var is None:
            continue

        lb_ape, ub_ape = _var_bounds(ape_var)
        lb_cie, ub_cie = _var_bounds(cie_var)
        max_diff = max(
            abs(ub_ape - lb_cie),
            abs(lb_ape - ub_cie)
        )

        abs_diff = model.NewIntVar(0, max_diff, _safe_name("type_balance", worker_rut))

        model.Add(abs_diff >= ape_var - cie_var)
        model.Add(abs_diff >= cie_var - ape_var)

        differences[worker_rut] = abs_diff
        penalties.append(abs_diff)

    return -cp_model.LinearExpr.Sum(penalties), differences

