from __future__ import annotations

from collections.abc import Callable
from typing import Any

from fastapi.routing import APIRouter as FastAPIRouter


class SlashAgnosticAPIRouter(FastAPIRouter):
    """Register both slash and non-slash variants for every HTTP route.

    FastAPI/Starlette normally redirects when the requested path only differs by
    a trailing slash. In this app that redirect can drop the Authorization
    header in browser flows, which then turns into spurious 401s. Registering
    both variants removes the redirect entirely.
    """

    @staticmethod
    def _alternate_path(path: str) -> str | None:
        if path == "/":
            return ""
        if path == "":
            return "/"
        if path.endswith("/"):
            return path[:-1]
        return f"{path}/"

    def add_api_route(
        self,
        path: str,
        endpoint: Callable[..., Any],
        *,
        include_in_schema: bool = True,
        **kwargs: Any,
    ) -> Any:
        canonical = super().add_api_route(
            path,
            endpoint,
            include_in_schema=include_in_schema,
            **kwargs,
        )

        alternate_path = self._alternate_path(path)
        if alternate_path is None or alternate_path == path:
            return canonical

        alt_kwargs = dict(kwargs)
        route_name = alt_kwargs.get("name") or getattr(endpoint, "__name__", "route")
        alt_kwargs["name"] = f"{route_name}__alt"

        super().add_api_route(
            alternate_path,
            endpoint,
            include_in_schema=False,
            **alt_kwargs,
        )
        return canonical


APIRouter = SlashAgnosticAPIRouter
