from __future__ import annotations

import argparse
import os
import sys
from collections import defaultdict
from pathlib import Path
from typing import Any

from dotenv import load_dotenv

ROOT_DIR = Path(__file__).resolve().parents[1]
load_dotenv(ROOT_DIR / ".env")

try:
    import pyodbc
except ImportError as exc:  # pragma: no cover
    raise SystemExit(
        "pyodbc no esta instalado. Ejecuta: pip install -r erp_zoro_python/requirements.txt"
    ) from exc


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


def build_connection_string(database: str) -> str:
    driver = os.getenv("ERP_SQLSERVER_DRIVER", "ODBC Driver 18 for SQL Server")
    host = os.getenv("ERP_SQLSERVER_HOST", "localhost")
    port = os.getenv("ERP_SQLSERVER_PORT", "1433")
    user = os.getenv("ERP_SQLSERVER_USER", "sa")
    password = os.getenv("ERP_SQLSERVER_PASSWORD", "")

    parts = [
        f"DRIVER={{{driver}}}",
        f"SERVER={host},{port}",
        f"DATABASE={database}",
        f"UID={user}",
        f"PWD={password}",
    ]

    if not _uses_legacy_sqlserver_driver(driver):
        encrypt = os.getenv("ERP_SQLSERVER_ENCRYPT", "no")
        trust_server_certificate = os.getenv(
            "ERP_SQLSERVER_TRUST_SERVER_CERTIFICATE",
            "yes",
        )
        parts.append(f"Encrypt={encrypt}")
        parts.append(f"TrustServerCertificate={trust_server_certificate}")

    extra_params = _parse_key_value_pairs(os.getenv("ERP_SQLSERVER_EXTRA_PARAMS"))
    for key, value in extra_params.items():
        parts.append(f"{key}={value}")

    return ";".join(parts) + ";"


def get_connection(database: str):
    driver = os.getenv("ERP_SQLSERVER_DRIVER", "ODBC Driver 18 for SQL Server")
    try:
        connection = pyodbc.connect(build_connection_string(database))
    except pyodbc.Error as exc:
        if _uses_legacy_sqlserver_driver(driver):
            raise SystemExit(
                "No se pudo conectar con el driver ODBC legado 'SQL Server'. "
                "Para SQL Server remoto/TLS instala 'ODBC Driver 18 for SQL Server' "
                "y configura ERP_SQLSERVER_DRIVER=ODBC Driver 18 for SQL Server."
            ) from exc
        raise
    connection.autocommit = True
    return connection


def fetch_tables(cursor) -> list[str]:
    rows = cursor.execute(
        """
        SELECT t.name
        FROM sys.tables t
        INNER JOIN sys.schemas s ON s.schema_id = t.schema_id
        WHERE s.name = 'dbo' AND t.name LIKE 'ERP%'
        ORDER BY t.name
        """
    ).fetchall()
    return [row[0] for row in rows]


def fetch_columns(cursor, table_name: str) -> list[dict[str, Any]]:
    rows = cursor.execute(
        """
        SELECT
            c.column_id,
            c.name AS column_name,
            ty.name AS type_name,
            c.max_length,
            c.precision,
            c.scale,
            c.is_nullable,
            c.is_identity,
            ic.seed_value,
            ic.increment_value,
            dc.definition AS default_definition
        FROM sys.columns c
        INNER JOIN sys.types ty ON c.user_type_id = ty.user_type_id
        LEFT JOIN sys.identity_columns ic ON ic.object_id = c.object_id AND ic.column_id = c.column_id
        LEFT JOIN sys.default_constraints dc ON dc.object_id = c.default_object_id
        WHERE c.object_id = OBJECT_ID(?)
        ORDER BY c.column_id
        """,
        f"dbo.{table_name}",
    ).fetchall()

    return [
        {
            "column_id": row[0],
            "column_name": row[1],
            "type_name": row[2],
            "max_length": row[3],
            "precision": row[4],
            "scale": row[5],
            "is_nullable": bool(row[6]),
            "is_identity": bool(row[7]),
            "seed_value": row[8],
            "increment_value": row[9],
            "default_definition": row[10],
        }
        for row in rows
    ]


def fetch_primary_keys(cursor) -> dict[str, dict[str, Any]]:
    rows = cursor.execute(
        """
        SELECT
            t.name AS table_name,
            kc.name AS constraint_name,
            c.name AS column_name,
            ic.key_ordinal
        FROM sys.key_constraints kc
        INNER JOIN sys.tables t ON t.object_id = kc.parent_object_id
        INNER JOIN sys.index_columns ic ON ic.object_id = kc.parent_object_id AND ic.index_id = kc.unique_index_id
        INNER JOIN sys.columns c ON c.object_id = ic.object_id AND c.column_id = ic.column_id
        WHERE kc.type = 'PK'
        ORDER BY t.name, ic.key_ordinal
        """
    ).fetchall()

    grouped: dict[str, dict[str, Any]] = {}
    for table_name, constraint_name, column_name, _ in rows:
        grouped.setdefault(
            table_name,
            {"constraint_name": constraint_name, "columns": []},
        )
        grouped[table_name]["columns"].append(column_name)
    return grouped


def fetch_unique_constraints(cursor) -> dict[str, list[dict[str, Any]]]:
    rows = cursor.execute(
        """
        SELECT
            t.name AS table_name,
            kc.name AS constraint_name,
            c.name AS column_name,
            ic.key_ordinal
        FROM sys.key_constraints kc
        INNER JOIN sys.tables t ON t.object_id = kc.parent_object_id
        INNER JOIN sys.index_columns ic ON ic.object_id = kc.parent_object_id AND ic.index_id = kc.unique_index_id
        INNER JOIN sys.columns c ON c.object_id = ic.object_id AND c.column_id = ic.column_id
        WHERE kc.type = 'UQ'
        ORDER BY t.name, kc.name, ic.key_ordinal
        """
    ).fetchall()

    grouped: dict[str, dict[str, list[str]]] = defaultdict(dict)
    for table_name, constraint_name, column_name, _ in rows:
        grouped[table_name].setdefault(constraint_name, [])
        grouped[table_name][constraint_name].append(column_name)

    response: dict[str, list[dict[str, Any]]] = {}
    for table_name, constraints in grouped.items():
        response[table_name] = [
            {"constraint_name": constraint_name, "columns": columns}
            for constraint_name, columns in constraints.items()
        ]
    return response


def fetch_foreign_keys(cursor) -> list[dict[str, Any]]:
    rows = cursor.execute(
        """
        SELECT
            fk.name AS constraint_name,
            tp.name AS parent_table,
            cp.name AS parent_column,
            tr.name AS referenced_table,
            cr.name AS referenced_column,
            fkc.constraint_column_id,
            fk.delete_referential_action_desc,
            fk.update_referential_action_desc
        FROM sys.foreign_keys fk
        INNER JOIN sys.foreign_key_columns fkc ON fkc.constraint_object_id = fk.object_id
        INNER JOIN sys.tables tp ON tp.object_id = fk.parent_object_id
        INNER JOIN sys.columns cp ON cp.object_id = fkc.parent_object_id AND cp.column_id = fkc.parent_column_id
        INNER JOIN sys.tables tr ON tr.object_id = fk.referenced_object_id
        INNER JOIN sys.columns cr ON cr.object_id = fkc.referenced_object_id AND cr.column_id = fkc.referenced_column_id
        WHERE tp.name LIKE 'ERP%' AND tr.name LIKE 'ERP%'
        ORDER BY fk.name, fkc.constraint_column_id
        """
    ).fetchall()

    grouped: dict[str, dict[str, Any]] = {}
    for row in rows:
        constraint_name = row[0]
        grouped.setdefault(
            constraint_name,
            {
                "constraint_name": constraint_name,
                "parent_table": row[1],
                "referenced_table": row[3],
                "parent_columns": [],
                "referenced_columns": [],
                "on_delete": row[6],
                "on_update": row[7],
            },
        )
        grouped[constraint_name]["parent_columns"].append(row[2])
        grouped[constraint_name]["referenced_columns"].append(row[4])
    return list(grouped.values())


def format_sql_type(column: dict[str, Any]) -> str:
    type_name = str(column["type_name"]).lower()
    max_length = int(column["max_length"])
    precision = int(column["precision"])
    scale = int(column["scale"])

    if type_name in {"varchar", "char", "varbinary", "binary"}:
        length = "MAX" if max_length == -1 else str(max_length)
        return f"{type_name.upper()}({length})"

    if type_name in {"nvarchar", "nchar"}:
        length = "MAX" if max_length == -1 else str(max_length // 2)
        return f"{type_name.upper()}({length})"

    if type_name in {"decimal", "numeric"}:
        return f"{type_name.upper()}({precision}, {scale})"

    if type_name in {"datetime2", "time", "datetimeoffset"}:
        return f"{type_name.upper()}({scale})"

    return type_name.upper()


def build_column_definition(column: dict[str, Any]) -> str:
    pieces = [f"[{column['column_name']}] {format_sql_type(column)}"]
    if column["is_identity"]:
        seed = int(column["seed_value"] or 1)
        increment = int(column["increment_value"] or 1)
        pieces.append(f"IDENTITY({seed},{increment})")
    if column["default_definition"]:
        pieces.append(f"DEFAULT {column['default_definition']}")
    pieces.append("NULL" if column["is_nullable"] else "NOT NULL")
    return " ".join(pieces)


def append_action(base_clause: str, keyword: str, action: str) -> str:
    normalized = str(action or "").upper()
    if normalized and normalized != "NO_ACTION":
        return f"{base_clause} {keyword} {normalized.replace('_', ' ')}"
    return base_clause


def build_schema_sql(source_db: str, target_db: str) -> str:
    with get_connection(source_db) as source_connection:
        cursor = source_connection.cursor()
        tables = fetch_tables(cursor)
        primary_keys = fetch_primary_keys(cursor)
        unique_constraints = fetch_unique_constraints(cursor)
        foreign_keys = fetch_foreign_keys(cursor)

        statements: list[str] = [
            f"IF DB_ID(N'{target_db}') IS NULL CREATE DATABASE [{target_db}];",
            "GO",
            f"USE [{target_db}];",
            "GO",
        ]

        for table_name in tables:
            columns = fetch_columns(cursor, table_name)
            statements.append(
                f"IF OBJECT_ID(N'[dbo].[{table_name}]', 'U') IS NOT NULL DROP TABLE [dbo].[{table_name}];"
            )
            column_sql = ",\n    ".join(build_column_definition(column) for column in columns)
            statements.append(f"CREATE TABLE [dbo].[{table_name}] (\n    {column_sql}\n);")
            statements.append("GO")

        for table_name, pk_data in primary_keys.items():
            columns_sql = ", ".join(f"[{column}]" for column in pk_data["columns"])
            statements.append(
                f"ALTER TABLE [dbo].[{table_name}] ADD CONSTRAINT [{pk_data['constraint_name']}] PRIMARY KEY ({columns_sql});"
            )
            statements.append("GO")

        for table_name, constraints in unique_constraints.items():
            for constraint in constraints:
                columns_sql = ", ".join(f"[{column}]" for column in constraint["columns"])
                statements.append(
                    f"ALTER TABLE [dbo].[{table_name}] ADD CONSTRAINT [{constraint['constraint_name']}] UNIQUE ({columns_sql});"
                )
                statements.append("GO")

        for foreign_key in foreign_keys:
            parent_columns = ", ".join(f"[{column}]" for column in foreign_key["parent_columns"])
            referenced_columns = ", ".join(
                f"[{column}]" for column in foreign_key["referenced_columns"]
            )
            clause = (
                f"ALTER TABLE [dbo].[{foreign_key['parent_table']}] "
                f"ADD CONSTRAINT [{foreign_key['constraint_name']}] "
                f"FOREIGN KEY ({parent_columns}) REFERENCES [dbo].[{foreign_key['referenced_table']}] ({referenced_columns})"
            )
            clause = append_action(clause, "ON DELETE", foreign_key["on_delete"])
            clause = append_action(clause, "ON UPDATE", foreign_key["on_update"])
            statements.append(clause + ";")
            statements.append("GO")

    return "\n".join(statements) + "\n"


def execute_sql_file(sql_text: str, target_db: str) -> None:
    batches = [batch.strip() for batch in sql_text.split("\nGO") if batch.strip()]
    with get_connection("master") as connection:
        cursor = connection.cursor()
        for batch in batches:
            cursor.execute(batch)
        cursor.commit()
    print(f"Base {target_db} creada o actualizada.")


def load_supplemental_sql() -> list[tuple[str, str]]:
    sql_dir = ROOT_DIR / "sql"
    blocks: list[tuple[str, str]] = []
    for path in sorted(sql_dir.glob("fase_*.sql")):
        content = path.read_text(encoding="utf-8").strip()
        if content:
            blocks.append((path.name, content))
    return blocks


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Genera y opcionalmente ejecuta el script de esquema para ERP_Zoro."
    )
    parser.add_argument(
        "--source-db",
        default=os.getenv("ERP_SQLSERVER_DATABASE", "ERP"),
        help="Base origen desde la que se tomara la estructura.",
    )
    parser.add_argument(
        "--target-db",
        default=os.getenv("ERP_SQLSERVER_TARGET_DATABASE", "ERP_Zoro"),
        help="Nombre de la base destino.",
    )
    parser.add_argument(
        "--output",
        default=str(ROOT_DIR / "sql" / "ERP_Zoro_schema.sql"),
        help="Ruta del archivo SQL generado.",
    )
    parser.add_argument(
        "--execute",
        action="store_true",
        help="Ejecuta el script generado sobre el SQL Server configurado.",
    )
    args = parser.parse_args()

    output_path = Path(args.output)
    output_path.parent.mkdir(parents=True, exist_ok=True)

    sql_text = build_schema_sql(args.source_db, args.target_db)
    for filename, supplemental_sql in load_supplemental_sql():
        if supplemental_sql:
            sql_text = (
                f"{sql_text.rstrip()}\n\n"
                f"-- Migracion complementaria: {filename}\n"
                f"{supplemental_sql}\n"
            )

    output_path.write_text(sql_text, encoding="utf-8")
    print(f"Script generado en: {output_path}")

    if args.execute:
        execute_sql_file(sql_text, args.target_db)

    return 0


if __name__ == "__main__":
    sys.exit(main())
