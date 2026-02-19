from __future__ import annotations

from fastapi import FastAPI

from server_fastapi.app.api.local_router import router as local_router
from server_fastapi.app.api.router import router as central_router
from server_fastapi.app.api.routes.legacy import router as legacy_router
from server_fastapi.app.core.config import get_settings
from server_fastapi.app.core.logging import configure_logging

settings = get_settings()


def create_app() -> FastAPI:
    configure_logging()

    app = FastAPI(title=settings.project_name, version='2.0.0')

    app.include_router(legacy_router)
    app.include_router(local_router)
    app.include_router(central_router, prefix=settings.central_prefix)
    app.include_router(central_router, prefix=settings.central_alias_prefix)

    return app


app = create_app()
