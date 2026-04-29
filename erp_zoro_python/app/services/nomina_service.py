from __future__ import annotations

from typing import Any

from fastapi import HTTPException
from sqlalchemy import text

from app.db.session import get_connection, get_transaction
from app.services import ledger_service
from app.services.sat_tablas_2024 import calcular_impuestos_periodo
from app.utils.company_access import build_in_clause, can_access_company, user_company_ids

# Importado aquí para evitar circular imports (facturama_service importa get_connection)
def _get_facturama():
    from app.services import facturama_service
    return facturama_service


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

        dias = int(payload.get("DiasLaborados", 15))
        for emp in empleados:
            sdi = float(emp.get("SalarioDiarioIntegrado") or emp["SalarioBase"] / 30)
            percepciones = round(float(emp["SalarioBase"]) / 30 * dias, 2)
            impuestos = calcular_impuestos_periodo(percepciones, sdi, dias)
            deducciones = impuestos["TotalDeducciones"]
            neto = round(percepciones - deducciones, 2)
            linea_id = conn.execute(
                text("""
                    INSERT INTO ERP_NOI_NOMINA_LINEAS (Nomina_Id, Empleado_Id, Percepciones, Deducciones, Neto)
                    OUTPUT INSERTED.NominaLinea_Id
                    VALUES (:nomina_id, :empleado_id, :percepciones, :deducciones, :neto)
                """),
                {
                    "nomina_id": nomina_id,
                    "empleado_id": emp["Empleado_Id"],
                    "percepciones": percepciones,
                    "deducciones": deducciones,
                    "neto": neto,
                },
            ).scalar()
            # Desglose en ERP_NOI_NOMINA_DETALLE
            _insertar_detalle(conn, linea_id, percepciones, impuestos)

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


def _insertar_detalle(conn: Any, linea_id: int, percepciones: float, impuestos: dict) -> None:
    """Persiste el desglose ISR/IMSS/SubsidioEmpleo en ERP_NOI_NOMINA_DETALLE."""
    conceptos = [
        ("001", "Sueldo", percepciones, percepciones, 0.0),
        ("ISR", "ISR retenido", -impuestos["ISR"], 0.0, impuestos["ISR"]),
        ("IMSS", "Cuota IMSS empleado", -impuestos["IMSS"], 0.0, impuestos["IMSS"]),
    ]
    if impuestos.get("SubsidioEmpleo", 0) > 0:
        conceptos.append(("SUB", "Subsidio al empleo", impuestos["SubsidioEmpleo"], 0.0, 0.0))

    for clave, desc, importe, gravado, exento in conceptos:
        conn.execute(
            text("""
                INSERT INTO ERP_NOI_NOMINA_DETALLE (NominaLinea_Id, Concepto_Id, Importe, Gravado, Exento)
                SELECT :linea_id,
                       ISNULL((SELECT TOP 1 Concepto_Id FROM ERP_NOI_CONCEPTOS WHERE Clave=:clave), NULL),
                       :importe, :gravado, :exento
            """),
            {"linea_id": linea_id, "clave": clave, "importe": importe, "gravado": gravado, "exento": exento},
        )


def calcular_nomina(nomina_id: int, current_user: dict[str, Any]) -> dict[str, Any]:
    """Recalcula ISR e IMSS de todas las líneas de una nómina en BORRADOR."""
    with get_connection() as conn:
        nom = conn.execute(
            text("SELECT Company_Id, Estatus, PeriodoInicio, PeriodoFin FROM ERP_NOI_NOMINAS WHERE Nomina_Id=:id"),
            {"id": nomina_id},
        ).mappings().first()
    if not nom:
        raise HTTPException(status_code=404, detail="Nómina no encontrada")
    _check_company(current_user, int(nom["Company_Id"]))
    if nom["Estatus"] == "CERRADA":
        raise HTTPException(status_code=400, detail="No se puede recalcular una nómina cerrada")

    with get_connection() as conn:
        lineas = conn.execute(
            text("""
                SELECT l.NominaLinea_Id, l.Percepciones,
                       ISNULL(e.SalarioDiarioIntegrado, e.SalarioBase/30) AS SDI
                FROM ERP_NOI_NOMINA_LINEAS l
                JOIN ERP_NOI_EMPLEADOS e ON e.Empleado_Id = l.Empleado_Id
                WHERE l.Nomina_Id = :id
            """),
            {"id": nomina_id},
        ).mappings().all()

    # Calcular días del período
    from datetime import date
    try:
        fi = date.fromisoformat(str(nom["PeriodoInicio"])[:10])
        ff = date.fromisoformat(str(nom["PeriodoFin"])[:10])
        dias = max(1, (ff - fi).days + 1)
    except Exception:
        dias = 15

    actualizadas = 0
    with get_transaction() as conn:
        # Borrar detalle previo
        conn.execute(
            text("""
                DELETE FROM ERP_NOI_NOMINA_DETALLE
                WHERE NominaLinea_Id IN (
                    SELECT NominaLinea_Id FROM ERP_NOI_NOMINA_LINEAS WHERE Nomina_Id=:id
                )
            """),
            {"id": nomina_id},
        )

        for linea in lineas:
            percepciones = float(linea["Percepciones"] or 0)
            sdi = float(linea["SDI"] or 0)
            impuestos = calcular_impuestos_periodo(percepciones, sdi, dias)
            deducciones = impuestos["TotalDeducciones"]
            neto = round(percepciones - deducciones, 2)

            conn.execute(
                text("""
                    UPDATE ERP_NOI_NOMINA_LINEAS
                    SET Deducciones=:d, Neto=:n
                    WHERE NominaLinea_Id=:id
                """),
                {"id": linea["NominaLinea_Id"], "d": deducciones, "n": neto},
            )
            _insertar_detalle(conn, int(linea["NominaLinea_Id"]), percepciones, impuestos)
            actualizadas += 1

        # Recalcular totales
        totales = conn.execute(
            text("SELECT SUM(Percepciones) AS tp, SUM(Deducciones) AS td, SUM(Neto) AS tn FROM ERP_NOI_NOMINA_LINEAS WHERE Nomina_Id=:id"),
            {"id": nomina_id},
        ).mappings().first()
        conn.execute(
            text("UPDATE ERP_NOI_NOMINAS SET TotalPercepciones=:tp, TotalDeducciones=:td, TotalNeto=:tn WHERE Nomina_Id=:id"),
            {"id": nomina_id, "tp": float(totales["tp"] or 0), "td": float(totales["td"] or 0), "tn": float(totales["tn"] or 0)},
        )

    return {"success": True, "message": f"Impuestos calculados para {actualizadas} empleados", "data": {"lineas": actualizadas}}


def timbrar_nomina(nomina_id: int, current_user: dict[str, Any]) -> dict[str, Any]:
    """Timbra los recibos de sueldo de una nómina CERRADA vía Facturama."""
    fac = _get_facturama()

    with get_connection() as conn:
        nom = conn.execute(
            text("SELECT Company_Id, Estatus, PeriodoInicio, PeriodoFin FROM ERP_NOI_NOMINAS WHERE Nomina_Id=:id"),
            {"id": nomina_id},
        ).mappings().first()
    if not nom:
        raise HTTPException(status_code=404, detail="Nómina no encontrada")
    _check_company(current_user, int(nom["Company_Id"]))
    if nom["Estatus"] != "CERRADA":
        raise HTTPException(status_code=400, detail="Solo se pueden timbrar nóminas cerradas")

    company_id = int(nom["Company_Id"])
    emisor = fac.get_emisor_data(company_id)

    with get_connection() as conn:
        lineas = conn.execute(
            text("""
                SELECT l.NominaLinea_Id, l.Empleado_Id, l.Percepciones, l.Deducciones, l.Neto,
                       l.EstadoTimbrado,
                       e.Nombre, e.RFC, e.CURP, e.NSS, e.SalarioBase, e.SalarioDiarioIntegrado,
                       e.Puesto, e.Departamento, e.TipoContrato, e.TipoJornada, e.FechaIngreso
                FROM ERP_NOI_NOMINA_LINEAS l
                JOIN ERP_NOI_EMPLEADOS e ON e.Empleado_Id = l.Empleado_Id
                WHERE l.Nomina_Id = :id
                  AND (l.EstadoTimbrado IS NULL OR l.EstadoTimbrado = 'ERROR')
            """),
            {"id": nomina_id},
        ).mappings().all()

        detalle_por_linea: dict[int, list] = {}
        if lineas:
            all_linea_ids = [int(l["NominaLinea_Id"]) for l in lineas]
            placeholders = ", ".join(f":lid{i}" for i, _ in enumerate(all_linea_ids))
            det_params = {f"lid{i}": lid for i, lid in enumerate(all_linea_ids)}
            det_rows = conn.execute(
                text(f"""
                    SELECT d.NominaLinea_Id, d.Importe, d.Gravado, d.Exento,
                           c.Clave, c.Descripcion
                    FROM ERP_NOI_NOMINA_DETALLE d
                    LEFT JOIN ERP_NOI_CONCEPTOS c ON c.Concepto_Id = d.Concepto_Id
                    WHERE d.NominaLinea_Id IN ({placeholders})
                """),
                det_params,
            ).mappings().all()
            for row in det_rows:
                lid = int(row["NominaLinea_Id"])
                detalle_por_linea.setdefault(lid, []).append(dict(row))

    timbrados = 0
    errores = 0
    detalles: list[dict] = []

    for linea in lineas:
        linea_id = int(linea["NominaLinea_Id"])
        empleado = dict(linea)
        detalle = detalle_por_linea.get(linea_id, [])
        linea_data = {
            **dict(linea),
            "PeriodoInicio": str(nom["PeriodoInicio"])[:10],
            "PeriodoFin": str(nom["PeriodoFin"])[:10],
            "DiasLaborados": 15,
        }

        try:
            result = fac.timbrar_recibo_nomina(emisor, empleado, linea_data, detalle, company_id)
            uuid = result.get("Uuid") or result.get("UUID") or result.get("uuid") or ""
            facturama_id = result.get("Id") or result.get("id") or ""
            xml_content = result.get("XmlContent") or result.get("xml") or ""

            with get_transaction() as conn:
                conn.execute(
                    text("""
                        UPDATE ERP_NOI_NOMINA_LINEAS SET
                            UUID=:uuid, FacturamaId=:fid,
                            XmlTimbrado=:xml, FechaTimbrado=GETDATE(),
                            EstadoTimbrado='TIMBRADO', ErrorTimbrado=NULL
                        WHERE NominaLinea_Id=:id
                    """),
                    {"uuid": uuid, "fid": str(facturama_id), "xml": xml_content, "id": linea_id},
                )
            timbrados += 1
            detalles.append({"linea_id": linea_id, "empleado": linea["Nombre"], "status": "TIMBRADO", "uuid": uuid})

        except Exception as exc:
            msg = str(exc)
            with get_transaction() as conn:
                conn.execute(
                    text("UPDATE ERP_NOI_NOMINA_LINEAS SET EstadoTimbrado='ERROR', ErrorTimbrado=:err WHERE NominaLinea_Id=:id"),
                    {"err": msg[:500], "id": linea_id},
                )
            errores += 1
            detalles.append({"linea_id": linea_id, "empleado": linea["Nombre"], "status": "ERROR", "error": msg[:200]})

    return {
        "success": True,
        "message": f"Timbrado: {timbrados} recibos, {errores} errores",
        "data": {"timbrados": timbrados, "errores": errores, "detalles": detalles},
    }


def get_xml_linea(linea_id: int, current_user: dict[str, Any]) -> dict[str, Any]:
    """Retorna el XML timbrado almacenado en BD para una línea de nómina."""
    with get_connection() as conn:
        row = conn.execute(
            text("""
                SELECT l.XmlTimbrado, l.UUID, l.EstadoTimbrado, n.Company_Id, e.Nombre, e.RFC
                FROM ERP_NOI_NOMINA_LINEAS l
                JOIN ERP_NOI_NOMINAS n ON n.Nomina_Id = l.Nomina_Id
                JOIN ERP_NOI_EMPLEADOS e ON e.Empleado_Id = l.Empleado_Id
                WHERE l.NominaLinea_Id = :id
            """),
            {"id": linea_id},
        ).mappings().first()
    if not row:
        raise HTTPException(status_code=404, detail="Línea no encontrada")
    _check_company(current_user, int(row["Company_Id"]))
    if not row["XmlTimbrado"]:
        raise HTTPException(status_code=404, detail="Esta línea no tiene XML timbrado")
    return {
        "success": True,
        "data": {
            "xml": row["XmlTimbrado"],
            "uuid": row["UUID"],
            "empleado": row["Nombre"],
            "rfc": row["RFC"],
        },
    }


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
