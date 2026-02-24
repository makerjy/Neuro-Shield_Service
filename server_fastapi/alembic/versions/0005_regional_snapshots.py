"""regional snapshots for regional-center persistence

Revision ID: 0005_regional_snapshots
Revises: 0004_citizen_comms_domain
Create Date: 2026-02-20
"""
from __future__ import annotations

from typing import Sequence

from alembic import op

revision: str = '0005_regional_snapshots'
down_revision: str | None = '0004_citizen_comms_domain'
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def _exec(sql: str) -> None:
    op.get_bind().exec_driver_sql(sql)


def upgrade() -> None:
    _exec(
        """
        CREATE TABLE IF NOT EXISTS local_center.regional_snapshots (
          snapshot_id varchar(64) PRIMARY KEY,
          scope_key varchar(128) NOT NULL UNIQUE,
          region_id varchar(64) NOT NULL,
          payload_json jsonb NOT NULL,
          created_at timestamptz NOT NULL DEFAULT now(),
          updated_at timestamptz NOT NULL DEFAULT now()
        )
        """
    )
    _exec(
        "CREATE INDEX IF NOT EXISTS ix_local_regional_snapshots_scope ON local_center.regional_snapshots (scope_key)"
    )
    _exec(
        "CREATE INDEX IF NOT EXISTS ix_local_regional_snapshots_region_updated ON local_center.regional_snapshots (region_id, updated_at)"
    )


def downgrade() -> None:
    _exec("DROP TABLE IF EXISTS local_center.regional_snapshots")
