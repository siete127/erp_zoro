from __future__ import annotations

import os
from dataclasses import dataclass, field
from pathlib import Path
from urllib.parse import quote_plus

from dotenv import load_dotenv


BASE_DIR = Path(__file__).resolve().parents[2]
load_dotenv(BASE_DIR / ".env")


def _split_csv(value: str | None) -> list[str]:
    if not value:
        return []
    return [item.strip() for item in value.split(",") if item.strip()]


def _parse_key_value_pairs(value: str | None) -> dict[str, str]:
    if not value:
        return {}

    parsed: dict[str, str] = {}
    for raw_item in value.split(";"):
        item = raw_item.strip()
        if not item or "=" not in item:
            continue
        key, raw_value = item.split("=", 1)
        key = key.strip()
        parsed_value = raw_value.strip()
        if key:
            parsed[key] = parsed_value
    return parsed


def _uses_legacy_sqlserver_driver(driver_name: str) -> bool:
    normalized = driver_name.strip().lower()
    return normalized in {
        "sql server",
        "sql server native client",
        "sql server native client 10.0",
        "sql server native client 11.0",
    }


@dataclass(frozen=True)
class Settings:
    app_name: str
    api_prefix: str
    sqlserver_host: str
    sqlserver_port: int
    sqlserver_database: str
    sqlserver_target_database: str
    sqlserver_user: str
    sqlserver_password: str
    sqlserver_driver: str
    sqlserver_encrypt: str
    sqlserver_trust_server_certificate: str
    sqlserver_extra_params: dict[str, str]
    jwt_secret: str
    access_token_expire_hours: int
    frontend_origins: list[str] = field(default_factory=list)
    redis_host: str = "localhost"
    redis_port: int = 6379
    redis_password: str | None = None
    redis_db: int = 0

    @classmethod
    def from_env(cls) -> "Settings":
        return cls(
            app_name=os.getenv("ERP_APP_NAME", "ERP Zoro Python"),
            api_prefix=os.getenv("ERP_API_PREFIX", "/api"),
            sqlserver_host=os.getenv("ERP_SQLSERVER_HOST", "localhost"),
            sqlserver_port=int(os.getenv("ERP_SQLSERVER_PORT", "1433")),
            sqlserver_database=os.getenv("ERP_SQLSERVER_DATABASE", "ERP"),
            sqlserver_target_database=os.getenv("ERP_SQLSERVER_TARGET_DATABASE", "ERP_Zoro"),
            sqlserver_user=os.getenv("ERP_SQLSERVER_USER", "sa"),
            sqlserver_password=os.getenv("ERP_SQLSERVER_PASSWORD", ""),
            sqlserver_driver=os.getenv("ERP_SQLSERVER_DRIVER", "ODBC Driver 18 for SQL Server"),
            sqlserver_encrypt=os.getenv("ERP_SQLSERVER_ENCRYPT", "no"),
            sqlserver_trust_server_certificate=os.getenv(
                "ERP_SQLSERVER_TRUST_SERVER_CERTIFICATE",
                "yes",
            ),
            sqlserver_extra_params=_parse_key_value_pairs(
                os.getenv("ERP_SQLSERVER_EXTRA_PARAMS")
            ),
            jwt_secret=os.getenv("ERP_SECRET_KEY", "ERP_SECRET_KEY"),
            access_token_expire_hours=int(os.getenv("ERP_ACCESS_TOKEN_EXPIRE_HOURS", "8")),
            frontend_origins=_split_csv(os.getenv("ERP_FRONTEND_ORIGINS")),
            redis_host=os.getenv("REDIS_HOST", "localhost"),
            redis_port=int(os.getenv("REDIS_PORT", "6379")),
            redis_password=os.getenv("REDIS_PASSWORD") or None,
            redis_db=int(os.getenv("REDIS_DB", "0")),
        )

    @property
    def uses_legacy_sqlserver_driver(self) -> bool:
        return _uses_legacy_sqlserver_driver(self.sqlserver_driver)

    def build_pyodbc_connection_string(self, database: str | None = None) -> str:
        selected_database = database or self.sqlserver_database
        parts = [
            f"DRIVER={{{self.sqlserver_driver}}}",
            f"SERVER={self.sqlserver_host},{self.sqlserver_port}",
            f"DATABASE={selected_database}",
            f"UID={self.sqlserver_user}",
            f"PWD={self.sqlserver_password}",
        ]

        if not self.uses_legacy_sqlserver_driver:
            parts.append(f"Encrypt={self.sqlserver_encrypt}")
            parts.append(
                f"TrustServerCertificate={self.sqlserver_trust_server_certificate}"
            )

        for key, value in self.sqlserver_extra_params.items():
            parts.append(f"{key}={value}")

        return ";".join(parts) + ";"

    def build_database_url(self, database: str | None = None) -> str:
        selected_database = database or self.sqlserver_database
        user = quote_plus(self.sqlserver_user)
        password = quote_plus(self.sqlserver_password)
        query_parts = [f"driver={quote_plus(self.sqlserver_driver)}"]

        if not self.uses_legacy_sqlserver_driver:
            query_parts.append(f"Encrypt={quote_plus(self.sqlserver_encrypt)}")
            query_parts.append(
                "TrustServerCertificate="
                f"{quote_plus(self.sqlserver_trust_server_certificate)}"
            )

        for key, value in self.sqlserver_extra_params.items():
            query_parts.append(f"{quote_plus(key)}={quote_plus(value)}")

        query_string = "&".join(query_parts)
        return (
            f"mssql+pyodbc://{user}:{password}@{self.sqlserver_host}:{self.sqlserver_port}/"
            f"{selected_database}?{query_string}"
        )

    @property
    def database_url(self) -> str:
        return self.build_database_url(self.sqlserver_database)

    @property
    def master_database_url(self) -> str:
        return self.build_database_url("master")


settings = Settings.from_env()
