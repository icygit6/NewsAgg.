"""Translation for the Yahoo TW -> English index (CLAUDE.md feature 1/4).

Primary: configurable Gemini Flash-Lite (if GEMINI_API_KEY is set).
Fallback: Lingva (https://lingva.ml) — no key required.

NOTE: the project's live Gemini key is currently quota-exhausted / on a
retired model (see memory ``gemini-key-state``), so in practice this resolves
to the Lingva fallback. Every function is fault-tolerant and returns None
rather than raising, so a translation outage never breaks a scrape run.
"""
from __future__ import annotations

import logging
from typing import Optional

import requests

from core import config

_log = logging.getLogger(__name__)

LINGVA_BASE = "https://lingva.ml/api/v1"


def _gemini_translate(text: str, target: str) -> Optional[str]:
    key = config.gemini_api_key()
    if not key:
        return None
    try:
        from google import genai
        client = genai.Client(api_key=key)
        prompt = (
            f"Translate the following text to {target}. "
            f"Return only the translation, no notes.\n\n{text[:4000]}"
        )
        resp = client.models.generate_content(
            model=os.getenv("GEMINI_TRANSLATE_MODEL", "gemini-3.5-flash-lite"),
            contents=prompt,
        )
        return (resp.text or "").strip() or None
    except Exception as e:                          # noqa: BLE001
        _log.debug("Gemini translate failed: %s", e)
        return None


def _lingva_translate(text: str, source: str, target: str) -> Optional[str]:
    try:
        url = f"{LINGVA_BASE}/{source}/{target}/{requests.utils.quote(text[:4000])}"
        r = requests.get(url, timeout=20)
        r.raise_for_status()
        return (r.json().get("translation") or "").strip() or None
    except Exception as e:                          # noqa: BLE001
        _log.debug("Lingva translate failed: %s", e)
        return None


def translate(text: str, target: str = "en", source: str = "auto") -> Optional[str]:
    """Translate ``text`` into ``target``. Gemini first, then Lingva. None on fail."""
    if not text or not text.strip():
        return None
    out = _gemini_translate(text, target)
    if out:
        return out
    return _lingva_translate(text, source, target)


def translate_record(record: dict, target: str = "en", source: str = "zh") -> dict:
    """Return {lang, title, description, content, ai_summary} for caching.

    Mirrors the ``translations`` table shape from CLAUDE.md. Fields that fail
    to translate are left as None so the caller can decide how to fall back.
    """
    return {
        "lang": target,
        "title": translate(record.get("title", ""), target, source),
        "description": translate(record.get("description", ""), target, source),
        "content": translate(record.get("content", ""), target, source),
        "ai_summary": translate(record.get("ai_summary", "") or "", target, source),
    }
