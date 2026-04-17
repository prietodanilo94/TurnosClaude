import copy
import json
from pathlib import Path

from fastapi.testclient import TestClient

from app.core.calendar import build_solver_input
from app.core.validators import validar_solucion
from app.main import app
from app.models.schemas import AssignmentOut, OptimizeRequest

FIXTURE_DIR = Path(__file__).parent / "fixtures"
client = TestClient(app)


def load_fixture(name: str) -> dict:
    return json.loads((FIXTURE_DIR / name).read_text(encoding="utf-8"))


def build_single_shift_payload(sunday_mode: str = "closed") -> dict:
    payload = load_fixture("standalone_basic.json")
    payload["holidays"] = []
    payload["shift_catalog"] = [
        {
            "id": "S_FULL",
            "inicio": "09:00",
            "fin": "14:00",
            "duracion_minutos": 300,
            "descuenta_colacion": False,
        }
    ]

    weekdays = ["lunes", "martes", "miercoles", "jueves", "viernes", "sabado"]
    for weekday in weekdays:
        payload["franja_por_dia"][weekday] = {"apertura": "09:00", "cierre": "14:00"}

    if sunday_mode == "open":
        payload["franja_por_dia"]["domingo"] = {"apertura": "09:00", "cierre": "14:00"}
    elif sunday_mode == "sundays_only":
        for weekday in weekdays:
            payload["franja_por_dia"][weekday] = None
        payload["franja_por_dia"]["domingo"] = {"apertura": "09:00", "cierre": "14:00"}
    else:
        payload["franja_por_dia"]["domingo"] = None

    return payload


def build_request(payload: dict) -> OptimizeRequest:
    return OptimizeRequest.model_validate(copy.deepcopy(payload))


def worker_slots(payload: dict) -> dict[str, int]:
    return {worker["rut"]: index + 1 for index, worker in enumerate(payload["workers"])}


def make_assignment(payload: dict, worker_rut: str, date: str, shift_id: str = "S_FULL") -> AssignmentOut:
    return AssignmentOut(
        worker_slot=worker_slots(payload)[worker_rut],
        worker_rut=worker_rut,
        date=date,
        shift_id=shift_id,
    )


def cycled_assignments(payload: dict, worker_ruts: list[str]) -> list[AssignmentOut]:
    req = build_request(payload)
    inp = build_solver_input(req)
    shift_id = req.shift_catalog[0].id

    assignments: list[AssignmentOut] = []
    for index, day in enumerate(d for d in inp.days if d.abierto):
        assignments.append(make_assignment(payload, worker_ruts[index % len(worker_ruts)], day.date, shift_id))
    return assignments


def open_dates_for_week(payload: dict, min_open_days: int) -> list[str]:
    req = build_request(payload)
    inp = build_solver_input(req)

    for week in inp.weeks:
        dates = [inp.days[day_idx].date for day_idx in week if inp.days[day_idx].abierto]
        if len(dates) >= min_open_days:
            return dates

    raise AssertionError(f"No se encontro una semana con al menos {min_open_days} dias abiertos")


def day_info_by_date(payload: dict) -> dict[str, object]:
    req = build_request(payload)
    inp = build_solver_input(req)
    return {day.date: day for day in inp.days}


def test_validar_solucion_acepta_solucion_valida():
    payload = build_single_shift_payload()
    other_workers = [worker["rut"] for worker in payload["workers"][1:]]
    assignments = cycled_assignments(payload, other_workers)

    violaciones = validar_solucion(assignments, build_request(payload))

    assert violaciones == []


def test_validar_solucion_detecta_horas_semanales_excedidas():
    payload = build_single_shift_payload()
    target_worker = payload["workers"][0]["rut"]
    other_workers = [worker["rut"] for worker in payload["workers"][1:]]
    assignments = cycled_assignments(payload, other_workers)
    week_dates = open_dates_for_week(payload, min_open_days=6)

    for date in week_dates:
        assignments.append(make_assignment(payload, target_worker, date))
    for date in week_dates[:3]:
        assignments.append(make_assignment(payload, target_worker, date))

    violaciones = validar_solucion(assignments, build_request(payload))

    assert any(v.tipo == "horas_semanales_excedidas" for v in violaciones)


def test_validar_solucion_detecta_dias_semanales_excedidos():
    payload = build_single_shift_payload(sunday_mode="open")
    target_worker = payload["workers"][0]["rut"]
    other_workers = [worker["rut"] for worker in payload["workers"][1:]]
    assignments = cycled_assignments(payload, other_workers)
    week_dates = open_dates_for_week(payload, min_open_days=7)

    for date in week_dates:
        assignments.append(make_assignment(payload, target_worker, date))

    violaciones = validar_solucion(assignments, build_request(payload))

    assert any(v.tipo == "dias_semanales_excedidos" for v in violaciones)


def test_validar_solucion_detecta_domingos_libres_insuficientes():
    payload = build_single_shift_payload(sunday_mode="sundays_only")
    target_worker = payload["workers"][0]["rut"]
    other_workers = [worker["rut"] for worker in payload["workers"][1:]]
    assignments = cycled_assignments(payload, other_workers)
    sunday_dates = open_dates_for_week(payload, min_open_days=1)

    # En mayo 2026 hay 5 domingos; asignamos 4 al mismo worker para dejarle solo 1 libre.
    req = build_request(payload)
    inp = build_solver_input(req)
    sunday_dates = [day.date for day in inp.days if day.abierto]
    for date in sunday_dates[:4]:
        assignments.append(make_assignment(payload, target_worker, date))

    violaciones = validar_solucion(assignments, req)

    assert any(v.tipo == "domingos_libres_insuficientes" for v in violaciones)


def test_validar_solucion_detecta_cobertura_insuficiente():
    payload = build_single_shift_payload()
    other_workers = [worker["rut"] for worker in payload["workers"][1:]]
    assignments = cycled_assignments(payload, other_workers)
    assignments.pop(0)

    violaciones = validar_solucion(assignments, build_request(payload))

    assert any(v.tipo == "cobertura_insuficiente" for v in violaciones)


def test_validar_solucion_detecta_feriado_asignado():
    payload = build_single_shift_payload()
    payload["holidays"] = ["2026-05-01"]
    target_worker = payload["workers"][0]["rut"]
    other_workers = [worker["rut"] for worker in payload["workers"][1:]]
    assignments = cycled_assignments(payload, other_workers)
    assignments.append(make_assignment(payload, target_worker, "2026-05-01"))

    violaciones = validar_solucion(assignments, build_request(payload))

    assert any(v.tipo == "feriado_asignado" for v in violaciones)


def test_validar_solucion_detecta_vacaciones_asignadas():
    payload = build_single_shift_payload()
    other_workers = [worker["rut"] for worker in payload["workers"][1:]]
    assignments = cycled_assignments(payload, other_workers)
    target_assignment = assignments[0]

    for worker in payload["workers"]:
        if worker["rut"] == target_assignment.worker_rut:
            worker["constraints"].append(
                {
                    "tipo": "vacaciones",
                    "desde": target_assignment.date,
                    "hasta": target_assignment.date,
                }
            )
            break

    violaciones = validar_solucion(assignments, build_request(payload))

    assert any(v.tipo == "vacaciones_asignadas" for v in violaciones)


def test_validar_solucion_detecta_dia_prohibido_asignado():
    payload = build_single_shift_payload()
    other_workers = [worker["rut"] for worker in payload["workers"][1:]]
    assignments = cycled_assignments(payload, other_workers)
    target_assignment = assignments[0]
    weekday = day_info_by_date(payload)[target_assignment.date].weekday

    for worker in payload["workers"]:
        if worker["rut"] == target_assignment.worker_rut:
            worker["constraints"].append(
                {
                    "tipo": "dia_prohibido",
                    "valor": weekday,
                }
            )
            break

    violaciones = validar_solucion(assignments, build_request(payload))

    assert any(v.tipo == "dia_prohibido_asignado" for v in violaciones)


def test_validar_solucion_detecta_turno_prohibido_asignado():
    payload = build_single_shift_payload()
    other_workers = [worker["rut"] for worker in payload["workers"][1:]]
    assignments = cycled_assignments(payload, other_workers)
    target_assignment = assignments[0]

    for worker in payload["workers"]:
        if worker["rut"] == target_assignment.worker_rut:
            worker["constraints"].append(
                {
                    "tipo": "turno_prohibido",
                    "valor": target_assignment.shift_id,
                }
            )
            break

    violaciones = validar_solucion(assignments, build_request(payload))

    assert any(v.tipo == "turno_prohibido_asignado" for v in violaciones)


def test_http_validate_devuelve_valido_true_para_solucion_valida():
    payload = build_single_shift_payload()
    other_workers = [worker["rut"] for worker in payload["workers"][1:]]
    assignments = cycled_assignments(payload, other_workers)
    payload["asignaciones"] = [assignment.model_dump() for assignment in assignments]

    response = client.post("/validate", json=payload)

    assert response.status_code == 200, response.text
    assert response.json() == {"valido": True, "violaciones": []}


def test_http_validate_devuelve_violaciones():
    payload = build_single_shift_payload()
    other_workers = [worker["rut"] for worker in payload["workers"][1:]]
    assignments = cycled_assignments(payload, other_workers)
    assignments.pop(0)
    payload["asignaciones"] = [assignment.model_dump() for assignment in assignments]

    response = client.post("/validate", json=payload)

    assert response.status_code == 200, response.text
    body = response.json()
    assert body["valido"] is False
    assert any(v["tipo"] == "cobertura_insuficiente" for v in body["violaciones"])
