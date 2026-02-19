from __future__ import annotations

import json
from typing import Any

import redis
from redis import Redis

from server_fastapi.app.core.config import get_settings

settings = get_settings()

_redis_client: Redis | None = None


def get_redis_client() -> Redis | None:
    global _redis_client
    if _redis_client is not None:
        return _redis_client
    try:
        _redis_client = redis.from_url(settings.redis_url, decode_responses=True)
        _redis_client.ping()
    except Exception:
        _redis_client = None
    return _redis_client


def get_json(key: str) -> dict[str, Any] | list[Any] | None:
    client = get_redis_client()
    if client is None:
        return None
    raw = client.get(key)
    if not raw:
        return None
    try:
        return json.loads(raw)
    except Exception:
        return None


def set_json(key: str, value: Any, ttl_seconds: int) -> None:
    client = get_redis_client()
    if client is None:
        return
    client.set(key, json.dumps(value, ensure_ascii=False), ex=ttl_seconds)


def delete_pattern(pattern: str) -> int:
    client = get_redis_client()
    if client is None:
        return 0
    deleted = 0
    for key in client.scan_iter(match=pattern):
        deleted += client.delete(key)
    return deleted
