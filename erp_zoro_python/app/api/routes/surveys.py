from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy import text

from app.api.deps import get_current_user
from app.db.session import get_connection

router = APIRouter()


class EncuestaBody(BaseModel):
    Titulo: str
    Descripcion: str | None = None
    EsPublica: bool = False


class PreguntaBody(BaseModel):
    Encuesta_Id: int
    Texto: str
    Tipo: str = "texto"      # texto | opcion_multiple | escala | si_no
    Opciones: str | None = None  # JSON string con opciones para opcion_multiple
    Requerida: bool = True
    Orden: int = 1


class RespuestaBody(BaseModel):
    Encuesta_Id: int
    NombreRespondente: str | None = None
    EmailRespondente: str | None = None
    Respuestas: list[dict]   # [{Pregunta_Id, Valor}]


# ─── ENCUESTAS ───────────────────────────────────────────────────────

@router.get("")
def list_encuestas(
    current_user: dict[str, Any] = Depends(get_current_user),
) -> dict[str, Any]:
    companies = current_user.get("companies", [])
    company_id = companies[0] if companies else None
    if not company_id:
        return {"items": [], "count": 0}
    try:
        with get_connection() as conn:
            result = conn.execute(
                text("""
                    SELECT e.Encuesta_Id, e.Titulo, e.Descripcion, e.EsPublica,
                           e.Estado, e.FechaCreacion,
                           COUNT(DISTINCT r.Respuesta_Id) as TotalRespuestas,
                           COUNT(DISTINCT p.Pregunta_Id) as TotalPreguntas
                    FROM ERP_SURVEY_ENCUESTA e
                    LEFT JOIN ERP_SURVEY_PREGUNTA p ON p.Encuesta_Id = e.Encuesta_Id
                    LEFT JOIN ERP_SURVEY_RESPUESTA r ON r.Encuesta_Id = e.Encuesta_Id
                    WHERE e.Company_Id = :cid
                    GROUP BY e.Encuesta_Id, e.Titulo, e.Descripcion, e.EsPublica,
                             e.Estado, e.FechaCreacion
                    ORDER BY e.FechaCreacion DESC
                """),
                {"cid": company_id},
            ).mappings().all()
            items = [dict(r) for r in result]
            return {"items": items, "count": len(items)}
    except Exception as e:
        return {"items": [], "count": 0, "error": str(e)}


@router.post("")
def create_encuesta(
    data: EncuestaBody,
    current_user: dict[str, Any] = Depends(get_current_user),
) -> dict[str, Any]:
    companies = current_user.get("companies", [])
    company_id = companies[0] if companies else None
    if not company_id:
        return {"error": "Sin empresa", "status": 400}
    try:
        with get_connection() as conn:
            conn.execute(
                text("""
                    INSERT INTO ERP_SURVEY_ENCUESTA
                    (Company_Id, Titulo, Descripcion, EsPublica, Estado, FechaCreacion)
                    VALUES (:cid, :titulo, :desc, :publica, 'activa', GETDATE())
                """),
                {
                    "cid": company_id, "titulo": data.Titulo,
                    "desc": data.Descripcion or "",
                    "publica": 1 if data.EsPublica else 0,
                },
            )
            result = conn.execute(text("SELECT SCOPE_IDENTITY()")).first()
            eid = int(result[0]) if result and result[0] else None
            conn.commit()
            return {"message": "Encuesta creada", "encuesta_id": eid, "status": 201}
    except Exception as e:
        return {"error": str(e), "status": 500}


@router.get("/{encuesta_id}")
def get_encuesta(
    encuesta_id: int,
    current_user: dict[str, Any] = Depends(get_current_user),
) -> dict[str, Any]:
    try:
        with get_connection() as conn:
            enc = conn.execute(
                text("SELECT * FROM ERP_SURVEY_ENCUESTA WHERE Encuesta_Id = :id"),
                {"id": encuesta_id},
            ).mappings().first()
            if not enc:
                return {"error": "Encuesta no encontrada", "status": 404}
            encuesta = dict(enc)

            preguntas = conn.execute(
                text("""
                    SELECT * FROM ERP_SURVEY_PREGUNTA
                    WHERE Encuesta_Id = :id ORDER BY Orden
                """),
                {"id": encuesta_id},
            ).mappings().all()
            encuesta["preguntas"] = [dict(p) for p in preguntas]
            return encuesta
    except Exception as e:
        return {"error": str(e), "status": 500}


@router.delete("/{encuesta_id}")
def delete_encuesta(
    encuesta_id: int,
    current_user: dict[str, Any] = Depends(get_current_user),
) -> dict[str, Any]:
    try:
        with get_connection() as conn:
            conn.execute(text("DELETE FROM ERP_SURVEY_DETALLE_RESPUESTA WHERE Encuesta_Id = :id"), {"id": encuesta_id})
            conn.execute(text("DELETE FROM ERP_SURVEY_RESPUESTA WHERE Encuesta_Id = :id"), {"id": encuesta_id})
            conn.execute(text("DELETE FROM ERP_SURVEY_PREGUNTA WHERE Encuesta_Id = :id"), {"id": encuesta_id})
            conn.execute(text("DELETE FROM ERP_SURVEY_ENCUESTA WHERE Encuesta_Id = :id"), {"id": encuesta_id})
            conn.commit()
            return {"message": "Encuesta eliminada"}
    except Exception as e:
        return {"error": str(e), "status": 500}


# ─── PREGUNTAS ───────────────────────────────────────────────────────

@router.post("/preguntas")
def add_pregunta(
    data: PreguntaBody,
    current_user: dict[str, Any] = Depends(get_current_user),
) -> dict[str, Any]:
    try:
        with get_connection() as conn:
            conn.execute(
                text("""
                    INSERT INTO ERP_SURVEY_PREGUNTA
                    (Encuesta_Id, Texto, Tipo, Opciones, Requerida, Orden)
                    VALUES (:eid, :texto, :tipo, :opciones, :req, :orden)
                """),
                {
                    "eid": data.Encuesta_Id, "texto": data.Texto, "tipo": data.Tipo,
                    "opciones": data.Opciones or "", "req": 1 if data.Requerida else 0,
                    "orden": data.Orden,
                },
            )
            conn.commit()
            return {"message": "Pregunta agregada", "status": 201}
    except Exception as e:
        return {"error": str(e), "status": 500}


@router.delete("/preguntas/{pregunta_id}")
def delete_pregunta(
    pregunta_id: int,
    current_user: dict[str, Any] = Depends(get_current_user),
) -> dict[str, Any]:
    try:
        with get_connection() as conn:
            conn.execute(text("DELETE FROM ERP_SURVEY_PREGUNTA WHERE Pregunta_Id = :id"), {"id": pregunta_id})
            conn.commit()
            return {"message": "Pregunta eliminada"}
    except Exception as e:
        return {"error": str(e), "status": 500}


# ─── RESPUESTAS (público: sin auth) ─────────────────────────────────

@router.post("/responder")
def responder_encuesta(data: RespuestaBody) -> dict[str, Any]:
    """Endpoint público para responder encuestas (sin auth requerida)."""
    try:
        with get_connection() as conn:
            conn.execute(
                text("""
                    INSERT INTO ERP_SURVEY_RESPUESTA
                    (Encuesta_Id, NombreRespondente, EmailRespondente, FechaRespuesta)
                    VALUES (:eid, :nombre, :email, GETDATE())
                """),
                {
                    "eid": data.Encuesta_Id,
                    "nombre": data.NombreRespondente or "Anónimo",
                    "email": data.EmailRespondente or "",
                },
            )
            result = conn.execute(text("SELECT SCOPE_IDENTITY()")).first()
            resp_id = int(result[0]) if result and result[0] else None

            for r in data.Respuestas:
                conn.execute(
                    text("""
                        INSERT INTO ERP_SURVEY_DETALLE_RESPUESTA
                        (Respuesta_Id, Encuesta_Id, Pregunta_Id, Valor)
                        VALUES (:rid, :eid, :pid, :valor)
                    """),
                    {
                        "rid": resp_id,
                        "eid": data.Encuesta_Id,
                        "pid": r.get("Pregunta_Id"),
                        "valor": str(r.get("Valor", "")),
                    },
                )
            conn.commit()
            return {"message": "Respuesta registrada", "respuesta_id": resp_id, "status": 201}
    except Exception as e:
        return {"error": str(e), "status": 500}


@router.get("/{encuesta_id}/resultados")
def get_resultados(
    encuesta_id: int,
    current_user: dict[str, Any] = Depends(get_current_user),
) -> dict[str, Any]:
    try:
        with get_connection() as conn:
            respuestas = conn.execute(
                text("""
                    SELECT r.Respuesta_Id, r.NombreRespondente, r.EmailRespondente, r.FechaRespuesta,
                           d.Pregunta_Id, d.Valor,
                           p.Texto as PreguntaTexto
                    FROM ERP_SURVEY_RESPUESTA r
                    JOIN ERP_SURVEY_DETALLE_RESPUESTA d ON d.Respuesta_Id = r.Respuesta_Id
                    JOIN ERP_SURVEY_PREGUNTA p ON p.Pregunta_Id = d.Pregunta_Id
                    WHERE r.Encuesta_Id = :eid
                    ORDER BY r.FechaRespuesta DESC
                """),
                {"eid": encuesta_id},
            ).mappings().all()

            total = conn.execute(
                text("SELECT COUNT(*) FROM ERP_SURVEY_RESPUESTA WHERE Encuesta_Id = :eid"),
                {"eid": encuesta_id},
            ).scalar()

            return {"total_respuestas": total, "items": [dict(r) for r in respuestas]}
    except Exception as e:
        return {"total_respuestas": 0, "items": [], "error": str(e)}


# ─── ENCUESTA PÚBLICA (sin auth) ────────────────────────────────────

@router.get("/publica/{encuesta_id}")
def get_encuesta_publica(encuesta_id: int) -> dict[str, Any]:
    try:
        with get_connection() as conn:
            enc = conn.execute(
                text("SELECT * FROM ERP_SURVEY_ENCUESTA WHERE Encuesta_Id = :id AND EsPublica = 1 AND Estado = 'activa'"),
                {"id": encuesta_id},
            ).mappings().first()
            if not enc:
                return {"error": "Encuesta no disponible", "status": 404}
            encuesta = dict(enc)
            preguntas = conn.execute(
                text("SELECT * FROM ERP_SURVEY_PREGUNTA WHERE Encuesta_Id = :id ORDER BY Orden"),
                {"id": encuesta_id},
            ).mappings().all()
            encuesta["preguntas"] = [dict(p) for p in preguntas]
            return encuesta
    except Exception as e:
        return {"error": str(e), "status": 500}
