"""Internal local embeddings client; no hosted/paid API fallback."""
import os
import requests
import math
import time

_retry_after = 0

def embed(texts):
    global _retry_after
    endpoint = os.getenv('LOCAL_AI_URL')
    if not endpoint or not texts or time.monotonic() < _retry_after:
        return None
    try:
        response = requests.post(endpoint.rstrip('/') + '/embed', json={'texts': texts}, timeout=45)
        response.raise_for_status()
        rows = response.json()['embeddings']
        if len(rows) != len(texts) or any(len(row) != 1024 or any(not math.isfinite(v) for v in row) for row in rows):
            raise ValueError('Invalid embedding response')
        return rows
    except (requests.RequestException, ValueError, KeyError, TypeError):
        _retry_after = time.monotonic() + 60
        return None
