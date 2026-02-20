from __future__ import annotations

from importlib import import_module

# Always register local/citizen/comms models for API runtime metadata.
from server_fastapi.app.models import citizen as _citizen_models  # noqa: F401
from server_fastapi.app.models import comms as _comms_models  # noqa: F401
from server_fastapi.app.models import local_center as _local_center_models  # noqa: F401

__all__: list[str] = []

# Central schemas are still loaded for migrations/runtime on supported interpreters.
for module_name in (
    'server_fastapi.app.models.control',
    'server_fastapi.app.models.ingestion',
    'server_fastapi.app.models.analytics',
):
    try:
        module = import_module(module_name)
    except Exception:  # pragma: no cover - local dev/runtime compatibility fallback
        continue

    exported_names = getattr(module, '__all__', None)
    if exported_names:
        for name in exported_names:
            globals()[name] = getattr(module, name)
            __all__.append(name)
        continue

    for name, value in module.__dict__.items():
        if name.startswith('_'):
            continue
        globals()[name] = value
        __all__.append(name)
