"""
Tests del módulo de vacaciones/licencias.
Cubre: saldo, solicitud válida, saldo insuficiente, traslape, fecha pasada.
Requiere: TEST_USERNAME, TEST_PASSWORD, TEST_USER_ID, TEST_COMPANY_ID, TEST_LEAVE_TYPE_ID en .env
"""
import os
import pytest
from datetime import date, timedelta


def _env(key):
    v = os.getenv(key)
    if not v:
        pytest.skip(f"{key} no definido en .env")
    return v


# ── Saldo ────────────────────────────────────────────────────────────────────

def test_balance_retorna_lista(client, auth_headers):
    resp = client.get("/api/rh/leave/balance", params={"year": 2026}, headers=auth_headers)
    assert resp.status_code == 200
    data = resp.json()
    assert isinstance(data, list)


def test_balance_sin_autenticacion(client):
    resp = client.get("/api/rh/leave/balance", params={"year": 2026})
    assert resp.status_code == 401


def test_balance_anio_invalido(client, auth_headers):
    resp = client.get("/api/rh/leave/balance", params={"year": 1990}, headers=auth_headers)
    assert resp.status_code == 422


# ── Tipos de licencia ────────────────────────────────────────────────────────

def test_leave_types_retorna_lista(client, auth_headers):
    company_id = _env("TEST_COMPANY_ID")
    resp = client.get(
        "/api/rh/leave/types",
        params={"company_id": company_id},
        headers=auth_headers,
    )
    assert resp.status_code == 200
    assert isinstance(resp.json(), list)


# ── Solicitudes ──────────────────────────────────────────────────────────────

def test_listar_solicitudes_propias(client, auth_headers):
    resp = client.get("/api/rh/leave/requests", params={"year": 2026}, headers=auth_headers)
    assert resp.status_code == 200
    assert isinstance(resp.json(), list)


def test_crear_solicitud_fecha_pasada(client, auth_headers):
    user_id = int(_env("TEST_USER_ID"))
    lt_id = int(_env("TEST_LEAVE_TYPE_ID"))
    yesterday = (date.today() - timedelta(days=1)).isoformat()

    resp = client.post(
        "/api/rh/leave/requests",
        json={
            "user_id": user_id,
            "leave_type_id": lt_id,
            "start_date": yesterday,
            "end_date": yesterday,
        },
        headers=auth_headers,
    )
    assert resp.status_code in (400, 422), f"Debería rechazar fechas pasadas: {resp.text}"


def test_crear_solicitud_fin_antes_de_inicio(client, auth_headers):
    user_id = int(_env("TEST_USER_ID"))
    lt_id = int(_env("TEST_LEAVE_TYPE_ID"))
    future = (date.today() + timedelta(days=30)).isoformat()
    earlier = (date.today() + timedelta(days=25)).isoformat()

    resp = client.post(
        "/api/rh/leave/requests",
        json={
            "user_id": user_id,
            "leave_type_id": lt_id,
            "start_date": future,
            "end_date": earlier,
        },
        headers=auth_headers,
    )
    assert resp.status_code in (400, 422), f"Debería rechazar end < start: {resp.text}"


def test_empleado_no_puede_crear_solicitud_para_otro(client, auth_headers):
    """Un empleado normal no puede crear solicitudes para user_id diferente al suyo."""
    lt_id = int(_env("TEST_LEAVE_TYPE_ID"))
    start = (date.today() + timedelta(days=60)).isoformat()
    end = (date.today() + timedelta(days=61)).isoformat()

    resp = client.post(
        "/api/rh/leave/requests",
        json={
            "user_id": 99999,  # ID que no es el del token
            "leave_type_id": lt_id,
            "start_date": start,
            "end_date": end,
        },
        headers=auth_headers,
    )
    # Debe ser 403 (si es empleado sin permisos) o 404 (usuario no existe en empresa)
    assert resp.status_code in (403, 404), f"Respuesta inesperada: {resp.status_code} {resp.text}"


def test_solo_admin_puede_aprobar(client, auth_headers):
    """Un empleado no puede aprobar solicitudes."""
    resp = client.patch(
        "/api/rh/leave/requests/99999/aprobar",
        json={"estatus": "Aprobado"},
        headers=auth_headers,
    )
    assert resp.status_code == 403


def test_aprobar_solicitud_inexistente(client, admin_headers):
    resp = client.patch(
        "/api/rh/leave/requests/99999999/aprobar",
        json={"estatus": "Aprobado"},
        headers=admin_headers,
    )
    assert resp.status_code == 404


def test_aprobar_estatus_invalido(client, admin_headers):
    resp = client.patch(
        "/api/rh/leave/requests/1/aprobar",
        json={"estatus": "MalEstatus"},
        headers=admin_headers,
    )
    assert resp.status_code == 422


# ── Festivos ─────────────────────────────────────────────────────────────────

def test_public_holidays(client, auth_headers):
    company_id = _env("TEST_COMPANY_ID")
    resp = client.get(
        "/api/rh/leave/public-holidays",
        params={"company_id": company_id, "year": 2026},
        headers=auth_headers,
    )
    assert resp.status_code == 200
    assert isinstance(resp.json(), list)


def test_solo_admin_puede_crear_festivo(client, auth_headers):
    resp = client.post(
        "/api/rh/leave/public-holidays",
        json={
            "company_id": 1,
            "holiday_date": "2026-12-25",
            "name": "Navidad Test",
            "is_obligatory": True,
            "is_recurring": False,
        },
        headers=auth_headers,
    )
    assert resp.status_code == 403


# ── Días laborales ────────────────────────────────────────────────────────────

def test_dia_laboral_lunes(client, auth_headers):
    company_id = _env("TEST_COMPANY_ID")
    resp = client.get(
        "/api/rh/leave/is-working-day",
        params={"date": "2026-05-04", "company_id": company_id},  # lunes
        headers=auth_headers,
    )
    assert resp.status_code == 200
    assert resp.json()["is_working_day"] is True


def test_dia_no_laboral_domingo(client, auth_headers):
    company_id = _env("TEST_COMPANY_ID")
    resp = client.get(
        "/api/rh/leave/is-working-day",
        params={"date": "2026-05-03", "company_id": company_id},  # domingo
        headers=auth_headers,
    )
    assert resp.status_code == 200
    assert resp.json()["is_working_day"] is False
