from __future__ import annotations

from contextlib import contextmanager
from typing import Any, Iterator
import pyodbc

from sqlalchemy import create_engine, text
from sqlalchemy.engine import Connection, Engine

from app.core.config import settings


def _get_available_drivers() -> list[str]:
    """Retorna lista de drivers ODBC disponibles."""
    try:
        available = pyodbc.drivers()
        return [d for d in available if 'SQL Server' in d]
    except Exception as e:
        raise RuntimeError(f"No se pueden listar drivers ODBC: {e}")


def _get_optimal_driver(preferred_driver: str | None = None) -> str:
    """
    Intenta encontrar el mejor driver disponible.
    
    Preferencia:
    1. Driver especificado en preferido (si está disponible)
    2. ODBC Driver 18 for SQL Server
    3. ODBC Driver 17 for SQL Server
    4. Cualquier driver de SQL Server disponible
    
    Raises RuntimeError si no hay drivers disponibles.
    """
    available_drivers = _get_available_drivers()
    
    if not available_drivers:
        raise RuntimeError(
            "ERROR CRITICO: No hay drivers ODBC para SQL Server instalados\n\n"
            "Soluciones:\n"
            "1. Descarga: https://learn.microsoft.com/en-us/sql/connect/odbc/download-odbc-driver-for-sql-server\n"
            "2. Ejecuta el instalador .msi de ODBC Driver 18\n"
            "3. Reinicia la terminal\n"
            "4. Intenta nuevamente\n\n"
            f"Drivers disponibles: {available_drivers}"
        )
    
    # Si hay driver preferido y está disponible, úsalo
    if preferred_driver and preferred_driver in available_drivers:
        print(f"[OK] Usando driver: {preferred_driver}")
        return preferred_driver
    
    # Intenta ODBC Driver 18 (preferido)
    for driver in available_drivers:
        if "18" in driver and "SQL Server" in driver:
            print(f"[OK] Driver preferido no disponible, usando: {driver}")
            return driver
    
    # Intenta ODBC Driver 17
    for driver in available_drivers:
        if "17" in driver and "SQL Server" in driver:
            print(f"[WARN] Driver 18 no disponible, usando: {driver}")
            return driver
    
    # Usa cualquier driver SQL Server disponible
    selected = available_drivers[0]
    print(f"[WARN] Usando driver disponible: {selected}")
    return selected


def _create_engine_with_fallback() -> Engine:
    """
    Crea engine con fallback automático entre múltiples drivers.
    """
    preferred_driver = settings.sqlserver_driver
    
    try:
        optimal_driver = _get_optimal_driver(preferred_driver)
    except RuntimeError as e:
        print(f"\n{e}\n")
        raise
    
    # Construir URL con driver óptimo
    database_url = _build_database_url_with_driver(optimal_driver)
    
    try:
        engine = create_engine(database_url, future=True, pool_pre_ping=True)
        
        # Probar conexión
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        
        print(f"[OK] Conexion a SQL Server exitosa con {optimal_driver}")
        return engine
        
    except Exception as e:
        raise RuntimeError(
            f"ERROR conectando a SQL Server con driver {optimal_driver}:\n\n"
            f"{type(e).__name__}: {str(e)}\n\n"
            "Verifica:\n"
            "1. Servidor SQL Server está corriendo\n"
            f"2. Host: {settings.sqlserver_host}:{settings.sqlserver_port}\n"
            f"3. Base de datos: {settings.sqlserver_database}\n"
            f"4. Usuario y contraseña válidos\n"
            "5. Firewall permite conexiones al puerto 1433"
        )


def _build_database_url_with_driver(driver: str) -> str:
    """Construye URL de SQLAlchemy con driver específico."""
    from urllib.parse import quote_plus
    
    selected_database = settings.sqlserver_database
    user = quote_plus(settings.sqlserver_user)
    password = quote_plus(settings.sqlserver_password)
    
    query_parts = [f"driver={quote_plus(driver)}"]
    
    # Agregar opciones de encriptación si no es legacy driver
    if "17" in driver or "18" in driver:
        query_parts.append(f"Encrypt={quote_plus(settings.sqlserver_encrypt)}")
        query_parts.append(
            f"TrustServerCertificate={quote_plus(settings.sqlserver_trust_server_certificate)}"
        )
    
    for key, value in settings.sqlserver_extra_params.items():
        query_parts.append(f"{quote_plus(key)}={quote_plus(value)}")
    
    query_string = "&".join(query_parts)
    return (
        f"mssql+pyodbc://{user}:{password}@"
        f"{settings.sqlserver_host}:{settings.sqlserver_port}/"
        f"{selected_database}?{query_string}"
    )


# Crear engine con fallback
try:
    engine = _create_engine_with_fallback()
except RuntimeError:
    raise


@contextmanager
def get_connection() -> Iterator[Connection]:
    with engine.connect() as connection:
        yield connection


@contextmanager
def get_transaction() -> Iterator[Connection]:
    with engine.begin() as connection:
        yield connection


def fetch_all(query: str, params: dict[str, Any] | None = None) -> list[dict[str, Any]]:
    with get_connection() as connection:
        result = connection.execute(text(query), params or {})
        return [dict(row) for row in result.mappings().all()]


def fetch_one(query: str, params: dict[str, Any] | None = None) -> dict[str, Any] | None:
    rows = fetch_all(query, params)
    return rows[0] if rows else None
