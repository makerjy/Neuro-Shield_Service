from server_fastapi.app.tasks import aggregate as _aggregate_tasks  # noqa: F401
from server_fastapi.app.tasks import citizen_tasks as _citizen_tasks  # noqa: F401
from server_fastapi.app.tasks import escalate as _escalate_tasks  # noqa: F401
from server_fastapi.app.tasks import ingest as _ingest_tasks  # noqa: F401
from server_fastapi.app.tasks import quality_check as _quality_check_tasks  # noqa: F401
from server_fastapi.app.tasks import regional as _regional_tasks  # noqa: F401
from server_fastapi.app.tasks import report as _report_tasks  # noqa: F401
from server_fastapi.app.tasks import scheduler as _scheduler_tasks  # noqa: F401
from server_fastapi.app.tasks import tasks as _local_tasks  # noqa: F401

__all__ = []
