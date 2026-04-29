"""Tests de autenticación: login válido, credenciales incorrectas, token inválido."""
import os
import pytest


def test_login_exitoso(client):
    username = os.getenv("TEST_USERNAME")
    password = os.getenv("TEST_PASSWORD")
    if not username or not password:
        pytest.skip("Credenciales de prueba no configuradas")

    resp = client.post("/api/auth/login", json={"username": username, "password": password})
    assert resp.status_code == 200
    data = resp.json()
    assert "token" in data
    assert "user" in data
    assert data["token"]


def test_login_password_incorrecto(client):
    username = os.getenv("TEST_USERNAME")
    if not username:
        pytest.skip("TEST_USERNAME no configurado")

    resp = client.post("/api/auth/login", json={"username": username, "password": "WRONG_PASS_XYZ"})
    assert resp.status_code in (400, 401, 422)


def test_login_usuario_inexistente(client):
    resp = client.post("/api/auth/login", json={"username": "no_existe_xyz_9999", "password": "cualquiera"})
    assert resp.status_code in (400, 401, 422)


def test_endpoint_protegido_sin_token(client):
    resp = client.get("/api/rh/leave/balance", params={"year": 2026})
    assert resp.status_code == 401


def test_endpoint_protegido_token_invalido(client):
    resp = client.get(
        "/api/rh/leave/balance",
        params={"year": 2026},
        headers={"Authorization": "Bearer token.invalido.aqui"},
    )
    assert resp.status_code == 401
