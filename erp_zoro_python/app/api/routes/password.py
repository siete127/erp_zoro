from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from app.services import password_service as svc

router = APIRouter()


class PasswordResetRequest(BaseModel):
    email: str


class PasswordResetConfirm(BaseModel):
    token: str
    newPassword: str


@router.post("/request-reset")
def request_reset(body: PasswordResetRequest):
    return svc.request_password_reset(body.email)


@router.get("/verify-token/{token}")
def verify_token(token: str):
    return svc.verify_reset_token(token)


@router.post("/reset")
def reset_password(body: PasswordResetConfirm):
    return svc.reset_password(body.token, body.newPassword)
