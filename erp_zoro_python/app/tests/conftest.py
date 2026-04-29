"""
Fixtures compartidos para todos los tests.
Los tests que requieren BD se saltan automáticamente si no hay conexión disponible.
"""
import os
import pytest
from fastapi.testclient import TestClient

# Importar la app — si falla la conexión a BD, los tests de integración se marcan skip
try:
    from app.main import app as fastapi_app
    _APP_AVAILABLE = True
except Exception:
    _APP_AVAILABLE = False


@pytest.fixture(scope="session")
def client():
    if not _APP_AVAILABLE:
        pytest.skip("App no disponible — verificar conexión a BD")
    with TestClient(fastapi_app) as c:
        yield c


@pytest.fixture(scope="session")
def auth_token(client):
    """Obtiene un token de un usuario de prueba definido en env vars."""
    username = os.getenv("TEST_USERNAME")
    password = os.getenv("TEST_PASSWORD")
    if not username or not password:
        pytest.skip("TEST_USERNAME / TEST_PASSWORD no definidos en .env")

    resp = client.post("/api/auth/login", json={"username": username, "password": password})
    assert resp.status_code == 200, f"Login fallido: {resp.text}"
    return resp.json()["token"]


@pytest.fixture(scope="session")
def admin_token(client):
    """Token de administrador para tests que requieren permisos elevados."""
    username = os.getenv("TEST_ADMIN_USERNAME") or os.getenv("TEST_USERNAME")
    password = os.getenv("TEST_ADMIN_PASSWORD") or os.getenv("TEST_PASSWORD")
    if not username or not password:
        pytest.skip("TEST_ADMIN_USERNAME / TEST_ADMIN_PASSWORD no definidos en .env")

    resp = client.post("/api/auth/login", json={"username": username, "password": password})
    assert resp.status_code == 200, f"Login admin fallido: {resp.text}"
    return resp.json()["token"]


@pytest.fixture(scope="session")
def auth_headers(auth_token):
    return {"Authorization": f"Bearer {auth_token}"}


@pytest.fixture(scope="session")
def admin_headers(admin_token):
    return {"Authorization": f"Bearer {admin_token}"}
