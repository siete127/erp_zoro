from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException

from app.api.deps import get_auth_token
from app.schemas.auth import LoginRequest, LoginResponse, LogoutRequest
from app.services import auth_service


router = APIRouter()


@router.post("/login", response_model=LoginResponse)
def login(payload: LoginRequest) -> dict:
    try:
        return auth_service.login(payload.username, payload.password)
    except PermissionError as exc:
        raise HTTPException(status_code=403, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=401, detail=str(exc)) from exc


@router.post("/logout")
def logout(
    payload: LogoutRequest,
    token: str | None = Depends(get_auth_token),
) -> dict:
    try:
        return auth_service.logout(payload.sessionId, token)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
