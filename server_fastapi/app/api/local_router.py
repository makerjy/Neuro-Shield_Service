from __future__ import annotations

from fastapi import APIRouter

from server_fastapi.app.api.routes.calendar import router as calendar_router
from server_fastapi.app.api.routes.cases import router as cases_router
from server_fastapi.app.api.routes.local_center import router as local_center_router
from server_fastapi.app.api.routes.stage2 import router as stage2_router
from server_fastapi.app.api.routes.stage3 import router as stage3_router

router = APIRouter()
router.include_router(cases_router)
router.include_router(calendar_router)
router.include_router(stage2_router)
router.include_router(stage3_router)
router.include_router(local_center_router)
