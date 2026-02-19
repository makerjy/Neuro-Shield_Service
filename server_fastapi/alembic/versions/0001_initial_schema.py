"""initial schema

Revision ID: 0001_initial_schema
Revises: 
Create Date: 2026-02-17
"""
from __future__ import annotations

from typing import Sequence

from alembic import op

from server_fastapi.app.db.base import Base
from server_fastapi.app.models import *  # noqa: F401,F403

revision: str = '0001_initial_schema'
down_revision: str | None = None
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.execute('CREATE SCHEMA IF NOT EXISTS control')
    op.execute('CREATE SCHEMA IF NOT EXISTS ingestion')
    op.execute('CREATE SCHEMA IF NOT EXISTS analytics')

    bind = op.get_bind()
    scoped_tables = [
        table for table in Base.metadata.sorted_tables if table.schema in {'control', 'ingestion', 'analytics'}
    ]
    Base.metadata.create_all(bind=bind, tables=scoped_tables)


def downgrade() -> None:
    bind = op.get_bind()
    scoped_tables = [
        table for table in Base.metadata.sorted_tables if table.schema in {'control', 'ingestion', 'analytics'}
    ]
    Base.metadata.drop_all(bind=bind, tables=scoped_tables)

    op.execute('DROP SCHEMA IF EXISTS analytics CASCADE')
    op.execute('DROP SCHEMA IF EXISTS ingestion CASCADE')
    op.execute('DROP SCHEMA IF EXISTS control CASCADE')
