from __future__ import annotations

from typing import Any

from fastapi import HTTPException
from sqlalchemy import text

from app.db.session import get_connection, get_transaction
from app.services import ledger_service
from app.utils.company_access import build_in_clause, can_access_company, user_company_ids


# ---------- helpers ----------

def _check_company(current_user: dict[str, Any], company_id: int) -> None:
    if not can_access_company(current_user, company_id):
        raise HTTPException(status_code=403, detail="Sin acceso a esta empresa")


def _company_filter(current_user: dict[str, Any], params: dict, alias: str = "") -> str:
    prefix = f"{alias}." if alias else ""
    if current_user.get("is_admin"):
        return ""
    companies = user_company_ids(current_user)
    if not companies:
        raise HTTPException(status_code=403, detail="Sin empresas asignadas")
    clause, clause_params = build_in_clause("company", companies)
    params.update(clause_params)
    return f" AND {prefix}Company_Id IN ({clause})"


# ---------- Empleados NOI ----------

def list_empleados(current_user: dict[str, Any], company_id: int | None = None) -> dict[str, Any]:
    params: dict[str, Any] = {}
    query = """
        SELECT e.Empleado_Id, e.Company_Id, c.NameCompany, e.Nombre, e.RFC, e.NSS, e.CURP,
               e.FechaIngreso, e.Activo, e.Puesto, e.Departamento, e.TipoContrato,
               e.TipoJornada, e.SalarioBase, e.SalarioDiarioIntegrado,
               e.Banco, e.CuentaBancaria, e.Clabe, e.CreatedAt
        FROM ERP_NOI_EMPLEADOS e
        LEFT JOIN ERP_COMPANY c ON c.Company_Id = e.Company_Id
        WHERE 1=1
    """
    query += _company_filter(current_user, params, "e")
    if company_id:
        query += " AND e.Company_Id = :filter_company"
        params["filter_company"] = company_id
    query += " ORDER BY e.Nombre"
    with get_connection() as conn:
        rows = conn.execute(text(query), params).mappings().all()
    return {"success": True, "data": [dict(r) for r in rows]}


def get_empleado(empleado_id: int, current_user: dict[str, Any]) -> dict[str, Any]:
    with get_connection() as conn:
        row = conn.execute(
            text("SELECT * FROM ERP_NOI_EMPLEADOS WHERE Empleado_Id = :id"),
            {"id": empleado_id},
        ).mappings().first()
    if not row:
        raise HTTPException(status_code=404, detail="Empleado no encontrado")
    _check_company(current_user, int(row["Company_Id"]))
    return {"success": True, "data": dict(row)}


def create_empleado(payload: dict[str, Any], current_user: dict[str, Any]) -> dict[str, Any]:
    company_id = payload.get("Company_Id")
    if not company_id:
        raise HTTPException(status_code=400, detail="Company_Id requerido")
    _check_company(current_user, int(company_id))
    with get_transaction() as conn:
        result = conn.execute(
            text("""
                INSERT INTO ERP_NOI_EMPLEADOS (
                    Company_Id, Nombre, RFC, NSS, CURP, FechaIngreso, Activo,
                    Puesto, Departamento, TipoContrato, TipoJornada,
                    SalarioBase, SalarioDiarioIntegrado, Banco, CuentaBancaria, Clabe
                )
                OUTPUT INSERTED.Empleado_Id
                VALUES (
                    :company_id, :nombre, :rfc, :nss, :curp, :fecha_ingreso, :activo,
                    :puesto, :departamento, :tipo_contrato, :tipo_jornada,
                    :salario_base, :sdi, :banco, :cuenta, :clabe
                )
            """),
            {
                "company_id": company_id,
                "nombre": payload.get("Nombre"),
                "rfc": payload.get("RFC"),
                "nss": payload.get("NSS"),
                "curp": payload.get("CURP"),
                "fecha_ingreso": payload.get("FechaIngreso"),
                "activo": payload.get("Activo", True),
                "puesto": payload.get("Puesto"),
                "departamento": payload.get("Departamento"),
                "tipo_contrato": payload.get("TipoContrato"),
                "tipo_jornada": payload.get("TipoJornada"),
                "salario_base": payload.get("SalarioBase", 0),
                "sdi": payload.get("SalarioDiarioIntegrado"),
                "banco": payload.get("Banco"),
                "cuenta": payload.get("CuentaBancaria"),
                "clabe": payload.get("Clabe"),
            },
        )
        emp_id = result.scalar()
    return {"success": True, "message": "Empleado creado", "data": {"Empleado_Id": emp_id}}


def update_empleado(empleado_id: int, payload: dict[str, Any], current_user: dict[str, Any]) -> dict[str, Any]:
    get_empleado(empleado_id, current_user)
    with get_transaction() as conn:
        conn.execute(
            text("""
                UPDATE ERP_NOI_EMPLEADOS SET
                    Nombre = COALESCE(:nombre, Nombre),
                    RFC = COALESCE(:rfc, RFC),
                    NSS = :nss, CURP = :curp,
                    FechaIngreso = COALESCE(:fecha_ingreso, FechaIngreso),
                    Activo = COALESCE(:activo, Activo),
                    Puesto = :puesto, Departamento = :departamento,
                    TipoContrato = :tipo_contrato, TipoJornada = :tipo_jornada,
                    SalarioBase = COALESCE(:salario_base, SalarioBase),
                    SalarioDiarioIntegrado = :sdi,
                    Banco = :banco, CuentaBancaria = :cuenta, Clabe = :clabe,
                    UpdatedAt = GETDATE()
                WHERE Empleado_Id = :id
            """),
            {
                "id": empleado_id,
                "nombre": payload.get("Nombre"),
                "rfc": payload.get("RFC"),
                "nss": payload.get("NSS"),
                "curp": payload.get("CURP"),
                "fecha_ingreso": payload.get("FechaIngreso"),
                "activo": payload.get("Activo"),
                "puesto": payload.get("Puesto"),
                "departamento": payload.get("Departamento"),
                "tipo_contrato": payload.get("TipoContrato"),
                "tipo_jornada": payload.get("TipoJornada"),
                "salario_base": payload.get("SalarioBase"),
                "sdi": payload.get("SalarioDiarioIntegrado"),
                "banco": payload.get("Banco"),
                "cuenta": payload.get("CuentaBancaria"),
                "clabe": payload.get("Clabe"),
            },
        )
    return {"success": True, "message": "Empleado actualizado"}


def delete_empleado(empleado_id: int, current_user: dict[str, Any]) -> dict[str, Any]:
    get_empleado(empleado_id, current_user)
    with get_transaction() as conn:
        conn.execute(
            text("UPDATE ERP_NOI_EMPLEADOS SET Activo=0 WHERE Empleado_Id=:id"),
            {"id": empleado_id},
        )
    return {"success": True, "message": "Empleado desactivado"}


# ---------- Conceptos ----------

def list_conceptos() -> dict[str, Any]:
    with get_connection() as conn:
        rows = conn.execute(
            text("SELECT * FROM ERP_NOI_CONCEPTOS ORDER BY Tipo, Clave")
        ).mappings().all()
    return {"success": True, "data": [dict(r) for r in rows]}


def create_concepto(payload: dict[str, Any]) -> dict[str, Any]:
    with get_transaction() as conn:
        result = conn.execute(
            text("""
                INSERT INTO ERP_NOI_CONCEPTOS (Tipo, Clave, Descripcion, EsGravado, EsExento)
                OUTPUT INSERTED.Concepto_Id
                VALUES (:tipo, :clave, :descripcion, :es_gravado, :es_exento)
            """),
            {
                "tipo": payload.get("Tipo"),
                "clave": payload.get("Clave"),
                "descripcion": payload.get("Descripcion"),
                "es_gravado": payload.get("EsGravado", True),
                "es_exento": payload.get("EsExento", False),
            },
        )
        cid = result.scalar()
    return {"success": True, "message": "Concepto creado", "data": {"Concepto_Id": cid}}


# ---------- Nóminas ----------

def list_nominas(current_user: dict[str, Any], company_id: int | None = None) -> dict[str, Any]:
    params: dict[str, Any] = {}
    query = """
        SELECT n.Nomina_Id, n.Company_Id, c.NameCompany, n.PeriodoInicio, n.PeriodoFin,
               n.Tipo, n.Estatus, n.TotalPercepciones, n.TotalDeducciones, n.TotalNeto,
               n.CreatedBy, n.CreatedAt
        FROM ERP_NOI_NOMINAS n
        LEFT JOIN ERP_COMPANY c ON c.Company_Id = n.Company_Id
        WHERE 1=1
    """
    query += _company_filter(current_user, params, "n")
    if company_id:
        query += " AND n.Company_Id = :filter_company"
        params["filter_company"] = company_id
    query += " ORDER BY n.PeriodoInicio DESC"
    with get_connection() as conn:
        rows = conn.execute(text(query), params).mappings().all()
    return {"success": True, "data": [dict(r) for r in rows]}


def get_nomina_detail(nomina_id: int, current_user: dict[str, Any]) -> dict[str, Any]:
    params: dict[str, Any] = {"nomina_id": nomina_id}
    with get_connection() as conn:
        nomina = conn.execute(
            text("SELECT * FROM ERP_NOI_NOMINAS WHERE Nomina_Id = :nomina_id"),
            params,
        ).mappings().first()
        if not nomina:
            raise HTTPException(status_code=404, detail="Nómina no encontrada")
        _check_company(current_user, int(nomina["Company_Id"]))

        lineas = conn.execute(
            text("""
                SELECT l.NominaLinea_Id, l.Empleado_Id, e.Nombre AS EmpleadoNombre,
                       e.RFC, l.Percepciones, l.Deducciones, l.Neto,
                       l.UUID, l.Serie, l.Folio, l.FechaTimbrado, l.EstadoTimbrado
                FROM ERP_NOI_NOMINA_LINEAS l
                JOIN ERP_NOI_EMPLEADOS e ON e.Empleado_Id = l.Empleado_Id
                WHERE l.Nomina_Id = :nomina_id
                ORDER BY e.Nombre
            """),
            params,
        ).mappings().all()

    return {
        "success": True,
        "data": {
            "nomina": dict(nomina),
            "lineas": [dict(l) for l in lineas],
        },
    }


def create_nomina(payload: dict[str, Any], current_user: dict[str, Any]) -> dict[str, Any]:
    company_id = payload.get("Company_Id")
    if not company_id:
        raise HTTPException(status_code=400, detail="Company_Id requerido")
    _check_company(current_user, int(company_id))

    username = current_user.get("Username") or current_user.get("username") or "sistema"

    with get_transaction() as conn:
        result = conn.execute(
            text("""
                INSERT INTO ERP_NOI_NOMINAS (Company_Id, PeriodoInicio, PeriodoFin, Tipo, Estatus, CreatedBy)
                OUTPUT INSERTED.Nomina_Id
                VALUES (:company_id, :inicio, :fin, :tipo, 'BORRADOR', :created_by)
            """),
            {
                "company_id": company_id,
                "inicio": payload.get("PeriodoInicio"),
                "fin": payload.get("PeriodoFin"),
                "tipo": payload.get("Tipo", "QUINCENAL"),
                "created_by": username,
            },
        )
        nomina_id = result.scalar()

        # Auto-generar líneas por cada empleado activo de la empresa
        empleados = conn.execute(
            text("SELECT Empleado_Id, SalarioBase FROM ERP_NOI_EMPLEADOS WHERE Company_Id=:cid AND Activo=1"),
            {"cid": company_id},
        ).mappings().all()

        for emp in empleados:
            dias = payload.get("DiasLaborados", 15)
            percepciones = round(float(emp["SalarioBase"]) / 30 * dias, 2)
            neto = percepciones
            conn.execute(
                text("""
                    INSERT INTO ERP_NOI_NOMINA_LINEAS (Nomina_Id, Empleado_Id, Percepciones, Deducciones, Neto)
                    VALUES (:nomina_id, :empleado_id, :percepciones, 0, :neto)
                """),
                {"nomina_id": nomina_id, "empleado_id": emp["Empleado_Id"], "percepciones": percepciones, "neto": neto},
            )

        # Recalcular totales
        totales = conn.execute(
            text("""
                SELECT SUM(Percepciones) AS tp, SUM(Deducciones) AS td, SUM(Neto) AS tn
                FROM ERP_NOI_NOMINA_LINEAS WHERE Nomina_Id=:id
            """),
            {"id": nomina_id},
        ).mappings().first()

        conn.execute(
            text("""
                UPDATE ERP_NOI_NOMINAS SET
                    TotalPercepciones=:tp, TotalDeducciones=:td, TotalNeto=:tn
                WHERE Nomina_Id=:id
            """),
            {
                "id": nomina_id,
                "tp": float(totales["tp"] or 0),
                "td": float(totales["td"] or 0),
                "tn": float(totales["tn"] or 0),
            },
        )

    return {"success": True, "message": "Nómina creada con líneas por empleados activos", "data": {"Nomina_Id": nomina_id}}


def cerrar_nomina(nomina_id: int, current_user: dict[str, Any]) -> dict[str, Any]:
    with get_connection() as conn:
        nom = conn.execute(
            text("SELECT Company_Id, Estatus FROM ERP_NOI_NOMINAS WHERE Nomina_Id=:id"),
            {"id": nomina_id},
        ).mappings().first()
    if not nom:
        raise HTTPException(status_code=404, detail="Nómina no encontrada")
    _check_company(current_user, int(nom["Company_Id"]))
    if nom["Estatus"] == "CERRADA":
        raise HTTPException(status_code=400, detail="La nómina ya está cerrada")

    with get_transaction() as conn:
        conn.execute(
            text("UPDATE ERP_NOI_NOMINAS SET Estatus='CERRADA' WHERE Nomina_Id=:id"),
            {"id": nomina_id},
        )
        # Asiento contable automático al cerrar nómina
        totales = conn.execute(
            text(
                """
                SELECT n.Company_Id,
                       ISNULL(SUM(l.Percepciones), 0) AS TotalPerc,
                       ISNULL(SUM(l.Deducciones), 0)  AS TotalDed,
                       ISNULL(SUM(l.Neto), 0)          AS TotalNeto
                FROM ERP_NOI_NOMINAS n
                LEFT JOIN ERP_NOI_NOMINA_LINEAS l ON l.Nomina_Id = n.Nomina_Id
                WHERE n.Nomina_Id = :id
                GROUP BY n.Company_Id
                """
            ),
            {"id": nomina_id},
        ).mappings().first()
        if totales and float(totales["TotalPerc"] or 0) > 0:
            try:
                ledger_service.post_nomina(
                    conn,
                    nomina_id=nomina_id,
                    company_id=int(totales["Company_Id"]),
                    total_percepciones=float(totales["TotalPerc"]),
                    total_deducciones=float(totales["TotalDed"]),
                    total_neto=float(totales["TotalNeto"]),
                )
            except Exception:
                pass  # best-effort
    return {"success": True, "message": "Nómina cerrada correctamente"}


def update_linea(linea_id: int, payload: dict[str, Any], current_user: dict[str, Any]) -> dict[str, Any]:
    with get_connection() as conn:
        linea = conn.execute(
            text("""
                SELECT l.NominaLinea_Id, n.Company_Id, n.Estatus
                FROM ERP_NOI_NOMINA_LINEAS l
                JOIN ERP_NOI_NOMINAS n ON n.Nomina_Id = l.Nomina_Id
                WHERE l.NominaLinea_Id = :id
            """),
            {"id": linea_id},
        ).mappings().first()
    if not linea:
        raise HTTPException(status_code=404, detail="Línea no encontrada")
    _check_company(current_user, int(linea["Company_Id"]))
    if linea["Estatus"] == "CERRADA":
        raise HTTPException(status_code=400, detail="No se puede editar una nómina cerrada")

    percepciones = float(payload.get("Percepciones", 0))
    deducciones = float(payload.get("Deducciones", 0))
    neto = percepciones - deducciones

    with get_transaction() as conn:
        conn.execute(
            text("""
                UPDATE ERP_NOI_NOMINA_LINEAS
                SET Percepciones=:p, Deducciones=:d, Neto=:n
                WHERE NominaLinea_Id=:id
            """),
            {"id": linea_id, "p": percepciones, "d": deducciones, "n": neto},
        )
        # Recalcular totales de la nómina
        linea_row = conn.execute(
            text("SELECT Nomina_Id FROM ERP_NOI_NOMINA_LINEAS WHERE NominaLinea_Id=:id"),
            {"id": linea_id},
        ).mappings().first()
        if linea_row:
            totales = conn.execute(
                text("SELECT SUM(Percepciones) AS tp, SUM(Deducciones) AS td, SUM(Neto) AS tn FROM ERP_NOI_NOMINA_LINEAS WHERE Nomina_Id=:nid"),
                {"nid": linea_row["Nomina_Id"]},
            ).mappings().first()
            conn.execute(
                text("UPDATE ERP_NOI_NOMINAS SET TotalPercepciones=:tp, TotalDeducciones=:td, TotalNeto=:tn WHERE Nomina_Id=:nid"),
                {"nid": linea_row["Nomina_Id"], "tp": float(totales["tp"] or 0), "td": float(totales["td"] or 0), "tn": float(totales["tn"] or 0)},
            )
    return {"success": True, "message": "Línea actualizada"}
