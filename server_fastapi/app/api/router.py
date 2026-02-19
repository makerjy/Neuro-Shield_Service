from __future__ import annotations

from fastapi import APIRouter

from server_fastapi.app.api.routes.central_dashboard import router as central_dashboard_router
from server_fastapi.app.api.routes.central_governance import router as central_governance_router
from server_fastapi.app.api.routes.central_ingest import router as central_ingest_router
from server_fastapi.app.api.routes.central_interventions import router as central_interventions_router
from server_fastapi.app.api.routes.central_stream import router as central_stream_router

router = APIRouter()
router.include_router(central_ingest_router)
router.include_router(central_dashboard_router)
router.include_router(central_governance_router)
router.include_router(central_interventions_router)
router.include_router(central_stream_router)
