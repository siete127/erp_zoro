from __future__ import annotations

from typing import Any


class ApiServiceError(Exception):
    def __init__(self, status_code: int, content: dict[str, Any]) -> None:
        super().__init__(content.get("message") or content.get("detail") or "API service error")
        self.status_code = status_code
        self.content = content
