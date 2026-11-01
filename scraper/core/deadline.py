"""Cooperative work cutoff; never turn a forced interruption into success."""
from datetime import datetime, timezone


def parse_stop_at(value):
    deadline = datetime.fromisoformat(value.replace('Z', '+00:00'))
    if deadline.tzinfo is None:
        raise ValueError('stop-at requires an explicit timezone')
    return deadline.astimezone(timezone.utc)


def stop_requested(deadline, now=None):
    return deadline is not None and (now or datetime.now(timezone.utc)) >= deadline
