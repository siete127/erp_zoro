from __future__ import annotations

from typing import Any

from fastapi import HTTPException


def normalize_company_ids(values: Any) -> list[int]:
    if values is None:
        return []

    if isinstance(values, (int, str)):
        values = [values]

    normalized: list[int] = []
    for value in values:
        try:
            number = int(value)
        except (TypeError, ValueError):
            continue
        if number > 0:
            normalized.append(number)
    return normalized


def build_in_clause(prefix: str, values: list[int]) -> tuple[str, dict[str, int]]:
    placeholders: list[str] = []
    params: dict[str, int] = {}
    for index, value in enumerate(values):
        key = f"{prefix}_{index}"
        placeholders.append(f":{key}")
        params[key] = int(value)
    return ", ".join(placeholders), params


def user_company_ids(current_user: dict[str, Any]) -> list[int]:
    return normalize_company_ids(current_user.get("companies"))


def can_access_company(current_user: dict[str, Any], company_id: int | None) -> bool:
    if company_id is None:
        return False
    if current_user.get("is_admin") or current_user.get("is_super_admin"):
        return True
    return int(company_id) in set(user_company_ids(current_user))


def assert_super_admin(current_user: dict[str, Any]) -> None:
    if not current_user.get("is_super_admin"):
        raise HTTPException(status_code=403, detail="Solo SuperAdmin puede realizar esta acción")
