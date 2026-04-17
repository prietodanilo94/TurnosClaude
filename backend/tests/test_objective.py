from ortools.sat.python import cp_model

from app.optimizer.objective import (
    build_balance_term,
    build_idleness_term,
    build_peak_coverage_term,
    build_weekend_term,
)


def solve_model(model: cp_model.CpModel) -> cp_model.CpSolver:
    solver = cp_model.CpSolver()
    solver.parameters.max_time_in_seconds = 5
    status = solver.Solve(model)
    assert status in (cp_model.OPTIMAL, cp_model.FEASIBLE)
    return solver


def test_build_peak_coverage_term_capea_slots_peak():
    model = cp_model.CpModel()
    coverage_by_slot = {
        ("2026-05-04", 16 * 60 + 30): model.NewIntVar(1, 1, "cov_pre_peak"),
        ("2026-05-04", 17 * 60): model.NewIntVar(4, 4, "cov_peak_1700"),
        ("2026-05-04", 17 * 60 + 30): model.NewIntVar(2, 2, "cov_peak_1730"),
    }

    term, capped = build_peak_coverage_term(
        model=model,
        coverage_by_slot=coverage_by_slot,
        peak_start_minute=17 * 60,
        coverage_cap=3,
    )
    model.Maximize(term)

    solver = solve_model(model)

    assert solver.Value(term) == 5
    assert solver.Value(capped[("2026-05-04", 17 * 60)]) == 3
    assert solver.Value(capped[("2026-05-04", 17 * 60 + 30)]) == 2
    assert ("2026-05-04", 16 * 60 + 30) not in capped


def test_build_weekend_term_solo_cuenta_finde():
    model = cp_model.CpModel()
    worked = {
        ("111", "2026-05-08"): model.NewBoolVar("fri"),
        ("111", "2026-05-09"): model.NewBoolVar("sat"),
        ("111", "2026-05-10"): model.NewBoolVar("sun"),
    }
    weekday_by_date = {
        "2026-05-08": "viernes",
        "2026-05-09": "sabado",
        "2026-05-10": "domingo",
    }

    model.Add(worked[("111", "2026-05-08")] == 1)
    model.Add(worked[("111", "2026-05-09")] == 1)
    model.Add(worked[("111", "2026-05-10")] == 1)

    term = build_weekend_term(worked, weekday_by_date)
    model.Maximize(term)

    solver = solve_model(model)

    assert solver.Value(term) == 2


def test_build_balance_term_prefiere_horas_balanceadas():
    model = cp_model.CpModel()
    worker_hours = {
        "111": model.NewIntVar(0, 6, "hours_111"),
        "222": model.NewIntVar(0, 6, "hours_222"),
    }
    total_hours = model.NewIntVar(6, 6, "total_hours")

    model.Add(worker_hours["111"] + worker_hours["222"] == total_hours)

    term, deviations = build_balance_term(
        model=model,
        worker_hours=worker_hours,
        total_hours=total_hours,
        num_workers=2,
    )
    model.Maximize(term)

    solver = solve_model(model)

    assert solver.Value(worker_hours["111"]) == 3
    assert solver.Value(worker_hours["222"]) == 3
    assert solver.Value(deviations["111"]) == 0
    assert solver.Value(deviations["222"]) == 0
    assert solver.Value(term) == 0


def test_build_idleness_term_penaliza_exceso_cuadratico():
    model = cp_model.CpModel()
    coverage_by_slot = {
        ("2026-05-04", 17 * 60): model.NewIntVar(3, 3, "cov_1700"),
        ("2026-05-04", 17 * 60 + 30): model.NewIntVar(1, 1, "cov_1730"),
    }
    targets = {
        ("2026-05-04", 17 * 60): 1,
        ("2026-05-04", 17 * 60 + 30): 1,
    }

    term, excess, squared = build_idleness_term(
        model=model,
        coverage_by_slot=coverage_by_slot,
        desired_coverage_by_slot=targets,
    )
    model.Maximize(term)

    solver = solve_model(model)

    assert solver.Value(excess[("2026-05-04", 17 * 60)]) == 2
    assert solver.Value(squared[("2026-05-04", 17 * 60)]) == 4
    assert solver.Value(excess[("2026-05-04", 17 * 60 + 30)]) == 0
    assert solver.Value(term) == -4
