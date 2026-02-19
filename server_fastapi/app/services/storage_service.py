from __future__ import annotations

import io

import boto3

from server_fastapi.app.core.config import get_settings

settings = get_settings()


_s3_client = None


def _client():
    global _s3_client
    if _s3_client is not None:
        return _s3_client

    _s3_client = boto3.client(
        's3',
        endpoint_url=settings.s3_endpoint,
        aws_access_key_id=settings.s3_access_key,
        aws_secret_access_key=settings.s3_secret_key,
    )

    return _s3_client


def ensure_bucket() -> None:
    client = _client()
    buckets = client.list_buckets().get('Buckets', [])
    if not any(bucket['Name'] == settings.s3_bucket for bucket in buckets):
        client.create_bucket(Bucket=settings.s3_bucket)


def upload_bytes(*, key: str, content: bytes, content_type: str) -> str:
    client = _client()
    ensure_bucket()
    client.upload_fileobj(io.BytesIO(content), settings.s3_bucket, key, ExtraArgs={'ContentType': content_type})
    return key
