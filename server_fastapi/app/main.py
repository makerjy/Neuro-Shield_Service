from __future__ import annotations

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from server_fastapi.app.api.local_router import router as local_router
from server_fastapi.app.api.router import router as central_router
from server_fastapi.app.api.routes.legacy import router as legacy_router
from server_fastapi.app.core.config import get_settings
from server_fastapi.app.core.logging import configure_logging, get_logger
from server_fastapi.app.db.session import SessionLocal
from server_fastapi.app.services.bootstrap_service import seed_demo_data_if_needed

settings = get_settings()
logger = get_logger(__name__)


def _run_startup_bootstrap() -> None:
    db = SessionLocal()
    try:
        result = seed_demo_data_if_needed(db, min_cases=20)
        logger.info('startup bootstrap seed result: %s', result)
    except Exception:
        logger.exception('startup bootstrap failed')
    finally:
        db.close()


def create_app() -> FastAPI:
    configure_logging()

    app = FastAPI(title=settings.project_name, version='2.0.0')
    allow_all_origins = '*' in settings.cors_origins
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_credentials=not allow_all_origins,
        allow_methods=['*'],
        allow_headers=['*'],
    )

    app.include_router(legacy_router)
    app.include_router(local_router)
    app.include_router(central_router, prefix=settings.central_prefix)
    app.include_router(central_router, prefix=settings.central_alias_prefix)

    @app.on_event('startup')
    def _on_startup() -> None:
        _run_startup_bootstrap()

    return app


app = create_app()
