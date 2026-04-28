from __future__ import annotations

from pathlib import Path

import fastapi as _fastapi
import fastapi.routing as _fastapi_routing
import socketio as _socketio
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles

from app.api.router_utils import SlashAgnosticAPIRouter
from app.core.config import settings
from app.core.exceptions import ApiServiceError
from app.core.socketio import sio
import app.sockets.chat_handler  # noqa: F401


_LOCAL_NETWORK_ORIGIN_REGEX = (
    r"https?://("
    r"localhost|127\.0\.0\.1|0\.0\.0\.0|"
    r"192\.168\.\d{1,3}\.\d{1,3}|"
    r"10\.\d{1,3}\.\d{1,3}\.\d{1,3}|"
    r"172\.(1[6-9]|2\d|3[0-1])\.\d{1,3}\.\d{1,3}"
    r")(:\d+)?$"
)

_fastapi.APIRouter = SlashAgnosticAPIRouter
_fastapi_routing.APIRouter = SlashAgnosticAPIRouter

from app.api.router import api_router


_fastapi_app = FastAPI(
    title=settings.app_name,
    version="0.1.0",
    description="Backend Python para ERP Zoro basado en la estructura del ERP actual.",
)

_fastapi_app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.frontend_origins or ["*"],
    allow_origin_regex=_LOCAL_NETWORK_ORIGIN_REGEX,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

_fastapi_app.include_router(api_router, prefix=settings.api_prefix)

uploads_dir = Path(__file__).resolve().parents[1] / "uploads"
uploads_dir.mkdir(parents=True, exist_ok=True)
(uploads_dir / "chat").mkdir(parents=True, exist_ok=True)
_fastapi_app.mount("/uploads", StaticFiles(directory=uploads_dir, check_dir=False), name="uploads")
_fastapi_app.mount(
    "/api/uploads",
    StaticFiles(directory=uploads_dir, check_dir=False),
    name="api-uploads",
)


@_fastapi_app.exception_handler(ApiServiceError)
async def handle_api_service_error(_: Request, exc: ApiServiceError) -> JSONResponse:
    return JSONResponse(status_code=exc.status_code, content=exc.content)


@_fastapi_app.get("/")
def healthcheck() -> dict[str, str]:
    return {
        "message": "ERP Backend Python funcionando",
        "source_database": settings.sqlserver_database,
        "target_database": settings.sqlserver_target_database,
    }


app = _socketio.ASGIApp(sio, other_asgi_app=_fastapi_app)
