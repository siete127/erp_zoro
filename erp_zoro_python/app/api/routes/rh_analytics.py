"""
Analytics endpoints para el módulo de Vacaciones — FASE 3
Rutas base: /rh/vacaciones/analytics/...
"""

import datetime
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from app.api.deps import get_current_user
from app.db.session import get_connection

router = APIRouter()

MESES = ["Ene", "Feb", "Mar", "Abr", "May", "Jun",
         "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"]


@router.get("/vacaciones/analytics/summary")
def analytics_summary(
    company_id: Optional[int] = None,
    year: Optional[int] = None,
    current_user: dict = Depends(get_current_user),
):
    """
    Resumen general: totales por estado, días consumidos,
    empleados con solicitudes en el año.
    """
    if not year:
        year = datetime.datetime.now().year

    try:
        with get_connection() as conn:
            cursor = conn.connection.cursor()

            company_filter = "AND u.Company_Id = ?" if company_id else ""
            params_base = [year, year]
            if company_id:
                params_base.append(company_id)

            cursor.execute(f"""
                SELECT
                    v.Estatus,
                    COUNT(*) AS cantidad,
                    SUM(ISNULL(v.Cantidad, 0)) AS total_dias
                FROM ERP_HR_VACATION_REQUEST v
                JOIN ERP_USERS u ON v.User_Id = u.User_Id
                WHERE (YEAR(v.FechaInicio) = ? OR YEAR(v.FechaFin) = ?)
                {company_filter}
                GROUP BY v.Estatus
            """, params_base)

            por_estado = {}
            for row in cursor.fetchall():
                estado, cantidad, dias = row
                por_estado[estado] = {
                    "cantidad": int(cantidad or 0),
                    "dias": int(dias or 0),
                }

            cursor.execute(f"""
                SELECT COUNT(DISTINCT v.User_Id)
                FROM ERP_HR_VACATION_REQUEST v
                JOIN ERP_USERS u ON v.User_Id = u.User_Id
                WHERE (YEAR(v.FechaInicio) = ? OR YEAR(v.FechaFin) = ?)
                {company_filter}
            """, params_base)

            row = cursor.fetchone()
            empleados_con_sol = int(row[0]) if row else 0

            total_dias = sum(v["dias"] for v in por_estado.values())
            total_solicitudes = sum(v["cantidad"] for v in por_estado.values())

            return {
                "year": year,
                "por_estado": por_estado,
                "total_solicitudes": total_solicitudes,
                "total_dias": total_dias,
                "empleados_con_solicitudes": empleados_con_sol,
            }

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error en analytics summary: {str(e)}")


@router.get("/vacaciones/analytics/by-month")
def analytics_by_month(
    company_id: Optional[int] = None,
    year: Optional[int] = None,
    current_user: dict = Depends(get_current_user),
):
    """
    Días de vacaciones aprobados agrupados por mes.
    Útil para gráfico de barras mensual.
    """
    if not year:
        year = datetime.datetime.now().year

    try:
        with get_connection() as conn:
            cursor = conn.connection.cursor()

            company_filter = "AND u.Company_Id = ?" if company_id else ""
            params = [year, year]
            if company_id:
                params.append(company_id)

            cursor.execute(f"""
                SELECT
                    MONTH(v.FechaInicio) AS mes,
                    COUNT(*) AS solicitudes,
                    SUM(ISNULL(v.Cantidad, 0)) AS dias
                FROM ERP_HR_VACATION_REQUEST v
                JOIN ERP_USERS u ON v.User_Id = u.User_Id
                WHERE v.Estatus = 'Aprobado'
                  AND (YEAR(v.FechaInicio) = ? OR YEAR(v.FechaFin) = ?)
                {company_filter}
                GROUP BY MONTH(v.FechaInicio)
                ORDER BY mes
            """, params)

            data = [{"mes": MESES[i], "mes_num": i + 1, "solicitudes": 0, "dias": 0}
                    for i in range(12)]

            for row in cursor.fetchall():
                mes, solicitudes, dias = row
                if 1 <= mes <= 12:
                    data[mes - 1]["solicitudes"] = int(solicitudes or 0)
                    data[mes - 1]["dias"] = int(dias or 0)

            return {"year": year, "data": data}

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error en analytics by-month: {str(e)}")


@router.get("/vacaciones/analytics/by-employee")
def analytics_by_employee(
    company_id: Optional[int] = None,
    year: Optional[int] = None,
    limit: int = Query(10, ge=1, le=50),
    current_user: dict = Depends(get_current_user),
):
    """
    Top empleados con más días de vacaciones aprobados.
    Requiere permisos de admin.
    """
    is_admin = current_user.get("is_admin", False)
    is_super = current_user.get("is_super_admin", False)
    if not is_admin and not is_super:
        raise HTTPException(status_code=403, detail="Se requieren permisos de admin")

    if not year:
        year = datetime.datetime.now().year

    try:
        with get_connection() as conn:
            cursor = conn.connection.cursor()

            company_filter = "AND u.Company_Id = ?" if company_id else ""
            params = [limit, year, year]
            if company_id:
                params.append(company_id)

            cursor.execute(f"""
                SELECT TOP (?)
                    u.User_Id,
                    ISNULL(u.Name + ' ' + ISNULL(u.Lastname, ''), u.Username) AS nombre,
                    COUNT(*) AS solicitudes,
                    SUM(ISNULL(v.Cantidad, 0)) AS dias_aprobados
                FROM ERP_HR_VACATION_REQUEST v
                JOIN ERP_USERS u ON v.User_Id = u.User_Id
                WHERE v.Estatus = 'Aprobado'
                  AND (YEAR(v.FechaInicio) = ? OR YEAR(v.FechaFin) = ?)
                {company_filter}
                GROUP BY u.User_Id, u.Name, u.Lastname, u.Username
                ORDER BY dias_aprobados DESC
            """, params)

            rows = []
            for row in cursor.fetchall():
                uid, nombre, solicitudes, dias = row
                rows.append({
                    "user_id": uid,
                    "nombre": nombre,
                    "solicitudes": int(solicitudes or 0),
                    "dias": int(dias or 0),
                })

            return {"year": year, "data": rows}

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error en analytics by-employee: {str(e)}")


@router.get("/vacaciones/analytics/pending-list")
def analytics_pending_list(
    company_id: Optional[int] = None,
    current_user: dict = Depends(get_current_user),
):
    """
    Lista detallada de solicitudes pendientes de aprobación.
    Requiere permisos de admin.
    """
    is_admin = current_user.get("is_admin", False)
    is_super = current_user.get("is_super_admin", False)
    if not is_admin and not is_super:
        raise HTTPException(status_code=403, detail="Se requieren permisos de admin")

    try:
        with get_connection() as conn:
            cursor = conn.connection.cursor()

            company_filter = "AND u.Company_Id = ?" if company_id else ""
            params = []
            if company_id:
                params.append(company_id)

            cursor.execute(f"""
                SELECT
                    v.Vacaciones_Id,
                    v.User_Id,
                    ISNULL(u.Name + ' ' + ISNULL(u.Lastname, ''), u.Username) AS nombre,
                    v.FechaInicio,
                    v.FechaFin,
                    v.Cantidad,
                    v.Razon,
                    v.CreatedAt
                FROM ERP_HR_VACATION_REQUEST v
                JOIN ERP_USERS u ON v.User_Id = u.User_Id
                WHERE v.Estatus = 'Pendiente'
                {company_filter}
                ORDER BY v.CreatedAt ASC
            """, params)

            rows = []
            for row in cursor.fetchall():
                vid, uid, nombre, f_inicio, f_fin, cantidad, razon, created = row
                rows.append({
                    "vacaciones_id": vid,
                    "user_id": uid,
                    "nombre": nombre,
                    "fecha_inicio": f_inicio.isoformat() if f_inicio else None,
                    "fecha_fin": f_fin.isoformat() if f_fin else None,
                    "cantidad": int(cantidad or 0),
                    "razon": razon or "",
                    "created_at": created.isoformat() if created else None,
                })

            return {"pendientes": rows, "total": len(rows)}

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error en analytics pending: {str(e)}")
