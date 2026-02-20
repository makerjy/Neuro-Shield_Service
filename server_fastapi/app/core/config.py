from __future__ import annotations

from functools import lru_cache
from typing import List

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file='.env', env_file_encoding='utf-8', extra='ignore')

    project_name: str = 'Neuro Shield Service API'
    environment: str = 'local'

    api_prefix: str = '/api'
    central_prefix: str = '/api/central'
    central_alias_prefix: str = '/central'
    base_path: str = Field(default='/neuro-shield/', alias='BASE_PATH')

    database_url: str = Field(default='postgresql+psycopg://dbuser:dbpass@db:5432/neuro', alias='DATABASE_URL')
    redis_url: str = Field(default='redis://redis:6379/0', alias='REDIS_URL')

    celery_broker_url: str = Field(default='redis://redis:6379/1', alias='CELERY_BROKER_URL')
    celery_result_backend: str = Field(default='redis://redis:6379/2', alias='CELERY_RESULT_BACKEND')

    s3_endpoint: str = Field(default='http://minio:9000', alias='S3_ENDPOINT')
    s3_access_key: str = Field(default='minioadmin', alias='S3_ACCESS_KEY')
    s3_secret_key: str = Field(default='minioadmin', alias='S3_SECRET_KEY')
    s3_bucket: str = Field(default='neuro-shield-artifacts', alias='S3_BUCKET')

    jwt_secret: str = Field(default='change-me', alias='JWT_SECRET')
    jwt_public_key: str | None = Field(default=None, alias='JWT_PUBLIC_KEY')
    otp_ttl_seconds: int = Field(default=300, alias='OTP_TTL_SECONDS')
    otp_max_attempts: int = Field(default=5, alias='OTP_MAX_ATTEMPTS')
    invite_token_ttl_hours: int = Field(default=48, alias='INVITE_TOKEN_TTL_HOURS')
    sms_provider_base_url: str = Field(default='http://sms:4120', alias='SMS_PROVIDER_BASE_URL')

    ingest_shared_secret: str = Field(default='change-me', alias='INGEST_SHARED_SECRET')

    kpi_refresh_cron: str = Field(default='*/5 * * * *', alias='KPI_REFRESH_CRON')
    report_cron: str = Field(default='0 3 * * *', alias='REPORT_CRON')

    cache_ttl_seconds: int = 90
    cache_min_ttl_seconds: int = 30
    cache_max_ttl_seconds: int = 120

    use_model: bool = Field(default=False, alias='USE_MODEL')
    model_path: str = Field(default='./models/model.pkl', alias='MODEL_PATH')
    model_gen_path: str = Field(default='./models/model_gen.pkl', alias='MODEL_GEN_PATH')
    model_scaler_path: str = Field(default='./models/model_scaler.pkl', alias='MODEL_SCALER_PATH')

    demo_mode: bool = Field(default=False, alias='DEMO_MODE')

    cors_origins: List[str] = Field(default_factory=lambda: ['*'])


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    return Settings()
