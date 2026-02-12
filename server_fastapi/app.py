from __future__ import annotations

import asyncio
import json
import os
from datetime import datetime, timezone
from typing import AsyncIterator

import psycopg
from fastapi import FastAPI
from fastapi.responses import JSONResponse, StreamingResponse

DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://dbuser:dbpass@db:5432/neuro")
ENVIRONMENT = os.getenv("ENVIRONMENT", "local")


def as_bool(value: str | None, default: bool = False) -> bool:
    if value is None:
        return default
    return value.strip().lower() in {"1", "true", "t", "yes", "y", "on"}


app = FastAPI(
    title="Neuro Shield Service API",
    version="1.0.0",
)


@app.get("/api/health")
async def health() -> dict[str, str]:
    return {
        "status": "ok",
        "service": "api",
        "environment": ENVIRONMENT,
    }


@app.get("/api/health/db", response_model=None)
async def health_db():
    try:
        with psycopg.connect(DATABASE_URL, connect_timeout=3) as conn:
            with conn.cursor() as cursor:
                cursor.execute("SELECT 1")
                cursor.fetchone()
        return {"status": "ok", "database": "reachable"}
    except Exception as exc:  # pragma: no cover
        return JSONResponse(
            status_code=503,
            content={
                "status": "error",
                "database": "unreachable",
                "detail": str(exc),
            },
        )


@app.get("/api/config")
async def config() -> dict[str, str | bool]:
    return {
        "environment": ENVIRONMENT,
        "use_model": as_bool(os.getenv("USE_MODEL"), default=False),
        "model_path": os.getenv("MODEL_PATH", ""),
        "model_gen_path": os.getenv("MODEL_GEN_PATH", ""),
        "model_scaler_path": os.getenv("MODEL_SCALER_PATH", ""),
        "demo_mode": as_bool(os.getenv("DEMO_MODE"), default=False),
    }


@app.get("/api/sse/heartbeat")
async def sse_heartbeat() -> StreamingResponse:
    async def event_stream() -> AsyncIterator[str]:
        seq = 0
        while True:
            seq += 1
            payload = {
                "seq": seq,
                "ts": datetime.now(timezone.utc).isoformat(),
                "type": "heartbeat",
            }
            yield f"event: heartbeat\ndata: {json.dumps(payload)}\n\n"
            await asyncio.sleep(1.0)

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )
