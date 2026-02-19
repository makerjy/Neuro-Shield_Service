from __future__ import annotations

import re
from typing import Any

BANNED_KEY_PATTERNS = [
    re.compile(pattern, re.IGNORECASE)
    for pattern in [
        r'name',
        r'rrn',
        r'ssn',
        r'phone',
        r'mobile',
        r'tel',
        r'address',
        r'email',
        r'주민',
        r'연락처',
        r'성명',
    ]
]

BANNED_VALUE_PATTERNS = [
    re.compile(r'\b01[0-9]-?\d{3,4}-?\d{4}\b'),
    re.compile(r'\b\d{2,6}-?\d{3,4}-?\d{4}\b'),
    re.compile(r'\b\d{6}-?[1-4]\d{6}\b'),
    re.compile(r'\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b'),
]


def _contains_banned_key(key: str) -> bool:
    return any(pattern.search(key) for pattern in BANNED_KEY_PATTERNS)


def _scan_value(value: Any, path: str, findings: list[str]) -> None:
    if isinstance(value, dict):
        for k, v in value.items():
            key_path = f'{path}.{k}' if path else k
            if _contains_banned_key(k):
                findings.append(f'banned_key:{key_path}')
            _scan_value(v, key_path, findings)
        return

    if isinstance(value, list):
        for idx, item in enumerate(value):
            _scan_value(item, f'{path}[{idx}]', findings)
        return

    if isinstance(value, str):
        for pattern in BANNED_VALUE_PATTERNS:
            if pattern.search(value):
                findings.append(f'banned_value:{path}')
                break


def detect_pii(payload: dict[str, Any]) -> list[str]:
    findings: list[str] = []
    _scan_value(payload, '', findings)
    return findings


def redact_payload(payload: Any) -> Any:
    if isinstance(payload, dict):
        redacted: dict[str, Any] = {}
        for k, v in payload.items():
            if _contains_banned_key(k):
                redacted[k] = '[REDACTED]'
            else:
                redacted[k] = redact_payload(v)
        return redacted
    if isinstance(payload, list):
        return [redact_payload(item) for item in payload]
    if isinstance(payload, str):
        masked = payload
        for pattern in BANNED_VALUE_PATTERNS:
            masked = pattern.sub('[REDACTED]', masked)
        return masked
    return payload
