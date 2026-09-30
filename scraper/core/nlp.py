"""NLP brain: HF model pipelines + sentiment / NER / toxicity / readability.

Models are loaded lazily (``functools.lru_cache`` singletons) and placed on
GPU automatically when available. Importing this module is cheap; the heavy
torch/transformers load happens on first actual use, so light tools that only
import ``core`` (e.g. cleanup.py) never pay for it.
"""
from __future__ import annotations

import logging
import re
import string
from collections import Counter
from functools import lru_cache
from typing import Optional

from core import config

_log = logging.getLogger(__name__)


# ── Lazy device + NLTK data ─────────────────────────────────────────
@lru_cache(maxsize=1)
def device() -> int:
    """0 = first CUDA GPU, -1 = CPU. Detected once."""
    try:
        import torch
        # Laptop CPU inference: avoid oversubscribing every core per tiny batch.
        torch.set_num_threads(2)
        if torch.cuda.is_available():
            print(f"[nlp] GPU: {torch.cuda.get_device_name(0)}")
            return 0
    except Exception:
        pass
    print("[nlp] device: CPU")
    return -1


@lru_cache(maxsize=1)
def ensure_nltk() -> None:
    # Runtime scraping must never block on an unbounded NLTK data download.
    # The pipeline uses regex sentence boundaries and a bundled stopword fallback.
    return None


@lru_cache(maxsize=1)
def stop_words() -> set[str]:
    ensure_nltk()
    from nltk.corpus import stopwords
    try:
        return set(stopwords.words("english"))
    except LookupError:
        return set('the and for from with this that these those their they them were was are has have had been being will would should could into onto about after before between because through over under more most some such only than then when where what which while whom how why not but all any can did does each few his her its our your out too very'.split())


# ── Lazy model pipelines ────────────────────────────────────────────
@lru_cache(maxsize=1)
def _sentiment_general():
    from transformers import pipeline
    return pipeline("sentiment-analysis", model=config.MODELS["sentiment_general"],
                    truncation=True, max_length=512, top_k=None, device=device())


@lru_cache(maxsize=1)
def _sentiment_finance():
    from transformers import pipeline
    return pipeline("sentiment-analysis", model=config.MODELS["sentiment_finance"],
                    truncation=True, max_length=512, top_k=None, device=device())


@lru_cache(maxsize=1)
def _classifier():
    from transformers import pipeline
    import torch
    # Transformers 5 defaults to the checkpoint's dtype (FP16 here).
    # mDeBERTa's author explicitly states FP16 is unsupported; force FP32.
    kwargs = {"device": device(), "dtype": torch.float32}
    tok = config.hf_token()
    if tok:
        kwargs["token"] = tok
    return pipeline("zero-shot-classification", model=config.MODELS["zero_shot"], **kwargs)


@lru_cache(maxsize=1)
def _ner():
    from transformers import pipeline
    return pipeline("ner", model=config.MODELS["ner"], aggregation_strategy="simple", device=device())


@lru_cache(maxsize=1)
def _toxicity():
    from transformers import pipeline
    return pipeline("text-classification", model=config.MODELS["toxicity"],
                    truncation=True, max_length=512, device=device())


def _sentiment_pipe(model_key: str):
    return _sentiment_finance() if model_key == "finance" else _sentiment_general()


# ── Sentiment ───────────────────────────────────────────────────────
def _norm_label(raw: str) -> str:
    s = str(raw).strip().lower()
    if "pos" in s:
        return "positive"
    if "neg" in s:
        return "negative"
    if "neu" in s:
        return "neutral"
    return {"label_0": "negative", "label_1": "neutral", "label_2": "positive"}.get(s, "neutral")


def _extract_probs(raw) -> dict:
    probs = {"positive": 0.0, "neutral": 0.0, "negative": 0.0}
    rows = raw
    if isinstance(rows, list) and rows and isinstance(rows[0], list):
        rows = rows[0]
    for e in rows:
        if not isinstance(e, dict):
            continue
        k = _norm_label(e.get("label", "neutral"))
        try:
            probs[k] = max(0.0, min(1.0, float(e["score"])))
        except Exception:
            pass
    total = sum(probs.values())
    if total > 0:
        probs = {k: v / total for k, v in probs.items()}
    return probs


def _classify(probs: dict) -> tuple:
    pos, neu, neg = probs["positive"], probs["neutral"], probs["negative"]
    pol = pos - neg
    if neu >= config.NEUTRAL_THRESHOLD and abs(pol) <= config.NEUTRAL_POLARITY_CAP:
        label = "neutral"
    elif pol >= config.POLARITY_MARGIN:
        label = "positive"
    elif pol <= -config.POLARITY_MARGIN:
        label = "negative"
    else:
        label = max(probs, key=probs.get)
    return label, round(probs[label], 4), round(pol, 4)


def resolve_sentiment_key(topic: str, language: str = "en") -> str:
    """Pick the sentiment model for an article. FinBERT is English-only, so
    Business articles in any other language route to the multilingual
    general model (XLM-R) instead."""
    key = config.SENTIMENT_MODEL_MAP.get(topic, "general")
    if key == "finance" and not (language or "en").startswith("en"):
        return "general"
    return key


def analyze_sentiment(text: str, topic: str, language: str = "en") -> dict:
    """Return article-level sentiment aggregated across several body chunks.

    The previous implementation classified only the first 1,500 characters,
    which over-weighted headlines and introductions. Three representative
    chunks provide broader coverage without making scraping prohibitively slow.
    """
    model_key = resolve_sentiment_key(topic, language)
    cleaned = (text or "").strip()
    window = 1400
    candidates = [cleaned[i:i + window] for i in range(0, len(cleaned), window)]
    if len(candidates) > 3:
        candidates = [candidates[0], candidates[len(candidates) // 2], candidates[-1]]
    candidates = [chunk for chunk in candidates if chunk.strip()]
    raw_rows = _sentiment_pipe(model_key)(candidates or [cleaned[:window]])
    aggregate = {"positive": 0.0, "neutral": 0.0, "negative": 0.0}
    total_weight = 0.0
    for chunk, raw in zip(candidates or [cleaned[:window]], raw_rows):
        chunk_probs = _extract_probs(raw)
        weight = max(1.0, float(len(chunk)))
        total_weight += weight
        for key in aggregate:
            aggregate[key] += chunk_probs[key] * weight
    probs = {key: value / total_weight for key, value in aggregate.items()} if total_weight else aggregate
    label, conf, pol = _classify(probs)
    return {
        "type": label,
        "score": conf,
        "comparative": pol,
        "probabilities": {
            "positive": round(probs["positive"], 4),
            "neutral": round(probs["neutral"], 4),
            "negative": round(probs["negative"], 4),
        },
        # Full HF id so articles.sentiment_model is self-documenting
        # (legacy rows hold the short 'general'/'finance' strings — fine).
        "model": config.MODELS["sentiment_" + model_key],
    }


# ── NER ─────────────────────────────────────────────────────────────
def run_ner(text: str) -> dict:
    entities = {"persons": [], "organizations": [], "locations": [], "misc": []}
    type_map = {"PER": "persons", "ORG": "organizations", "LOC": "locations", "MISC": "misc"}
    try:
        chunks = [text[i:i + 1400] for i in range(0, len(text), 1400)]
        if len(chunks) > 3:
            chunks = [chunks[0], chunks[len(chunks)//2], chunks[-1]]
        for chunk in chunks:
            raw = _ner()(chunk)
            for ent in raw:
                key = type_map.get(ent["entity_group"])
                word = (ent.get("word") or "").strip()
                if key and word and word not in entities[key]:
                    entities[key].append(word)
    except Exception as e:                         # noqa: BLE001
        _log.debug("NER failed: %s", e)
    return entities


# ── Toxicity ────────────────────────────────────────────────────────
def run_toxicity(text: str, language: str = "en") -> dict:
    """toxic-bert is English-only: non-EN articles get NULLs instead of
    garbage scores (a multilingual replacement is ~2.2GB for a low-value
    signal on news prose — deliberately skipped)."""
    if not (language or "en").lower().startswith("en") or not text.strip():
        return {"label": None, "score": None}
    label, score = None, None
    try:
        # toxic-bert is multilabel. The top label may be "obscene" or "insult";
        # the displayed toxicity score must specifically use its "toxic" output.
        tox = _toxicity()(text[:512], top_k=None)
        if isinstance(tox, list) and tox and isinstance(tox[0], list):
            tox = tox[0]
        result = next((item for item in tox if item.get("label", "").lower() == "toxic"), None)
        if result is not None and result.get("score") is not None:
            probability = float(result["score"])
            if 0 <= probability <= 1:
                score = round(probability, 4)
                label = "toxic" if probability > 0.5 else "non-toxic"
    except Exception as e:                         # noqa: BLE001
        _log.debug("toxicity failed: %s", e)
    return {"label": label, "score": score}


# ── Zero-shot relevance filter ──────────────────────────────────────
def zero_shot_filter(candidates: list[dict], threshold: float = config.ZS_THRESHOLD) -> list[dict]:
    """Keep candidates whose title relates to their topic; annotate relevance.

    All candidates must share the same ``topic`` (callers batch per category).
    Adds ai_relevance_score / ai_top_label / ai_label_scores to survivors.
    """
    from core.cleaner import PHOTO_RE
    from core.taxonomy import LOCAL_LABELS, VERSION, classification_context, needs_focus_review
    if not candidates:
        return []
    valid, titles = [], []
    for item in candidates:
        t = item["title_hint"]
        if not PHOTO_RE.search(t) and len(t) >= (8 if re.search(r'[\u3400-\u9fff]', t) else 15):
            valid.append(item)
            context = item.get('content_hint', '')
            cjk = len(re.findall(r'[\u3400-\u9fff]', context)) > len(context) * .2
            # Keep all three excerpts within the local model's token window;
            # CJK consumes substantially more tokens per character than English.
            titles.append(t[:160] + '\n' + classification_context(context, 300 if cjk else 900))
    if not valid:
        return []
    labels = list(LOCAL_LABELS.values())
    topic_by_label = {description: topic for topic, description in LOCAL_LABELS.items()}
    try:
        out = _classifier()(titles, candidate_labels=labels, multi_label=False, hypothesis_template='This news is about {}.')
        if isinstance(out, dict):
            out = [out]
        result = []
        for item, res in zip(valid, out):
            res = {**res, 'labels': [topic_by_label.get(label, label) for label in res['labels']]}
            scores = dict(zip(res['labels'], res['scores']))
            margin = res['scores'][0] - (res['scores'][1] if len(res['scores']) > 1 else 0)
            # A shared publisher feed is not proof of category membership.
            # Keep only positive evidence for the requested category; report
            # deficits instead of accepting ambiguous cross-category stories.
            if res['labels'][0] != item['topic'] or scores.get(item['topic'], 0) < threshold or margin < .12 or needs_focus_review(item['title_hint'], item['topic']):
                # A confident competing topic does not need an API call. Keep
                # the bounded hosted budget for genuinely ambiguous candidates.
                if res['labels'][0] != item['topic'] and res['scores'][0] >= .65 and res['scores'][0] - scores.get(item['topic'], 0) >= .25:
                    item['rejection'] = 'category_mismatch'
                    continue
                from core.category import second_opinion
                diagnostic = {}
                opinion = second_opinion(item['title_hint'], classification_context(item.get('content_hint', '')),
                                         requested_topic=item['topic'], source=item.get('source_key'), diagnostic=diagnostic)
                if not opinion or opinion['category'] != item['topic']:
                    item['rejection'] = ('category_unverified' + ('_' + diagnostic['reason'] if diagnostic.get('reason') else '')) if not opinion else 'category_mismatch'
                    continue
                # LLM category decisions have no calibrated numerical score.
                item['ai_relevance_score'] = None
                item['ai_top_label'] = opinion['category']
                item['ai_label_scores'] = {}
                item['category_model'] = opinion['model']
                item['category_taxonomy'] = VERSION
                result.append(item)
                continue
            item['ai_relevance_score'] = round(scores.get(item['topic'], 0), 4)
            item['ai_top_label'] = res['labels'][0]
            item['ai_label_scores'] = {k: round(v, 4) for k,v in scores.items()}
            item['category_model'] = config.MODELS['zero_shot']
            item['category_taxonomy'] = VERSION
            if res['labels'][0] != item['topic']:
                item['ai_top_label'] = None
                item['ai_label_scores'] = {}
            result.append(item)
        return result
    except Exception as e:                         # noqa: BLE001
        print(f"  zero-shot filter error: {e}")
        return []


# ── Keywords / readability / language ───────────────────────────────
def _keyword_ok(tok: str, sw: set[str]) -> bool:
    """Keep only meaningful keyword tokens: ≥4 chars, no digits, not a
    stopword (NLTK + the project's news-prose stoplist)."""
    return 3 < len(tok) <= 40 and tok not in sw and not any(c.isdigit() for c in tok)


def extract_keywords(text: str, np_kw: list, entities: dict,
                     top_n: int = config.KEYWORDS_TOP_N) -> list[str]:
    sw = stop_words() | config.KEYWORD_STOPWORDS
    if len(re.findall(r'[\u3400-\u9fff]', text)) > len(text) * .2:
        try:
            import jieba.analyse
            return [w for w in jieba.analyse.extract_tags(text, topK=top_n*2) if 2 <= len(w) <= 12][:top_n]
        except ImportError:
            return list(dict.fromkeys(e for values in entities.values() for e in values if 2 <= len(e) <= 12))[:top_n]
    combined: dict[str, int] = {}
    for kw in np_kw:
        k = kw.lower().strip()
        if _keyword_ok(k, sw):
            combined[k] = combined.get(k, 0) + 3
    for elist in entities.values():
        for ent in elist:
            for tok in ent.lower().split():
                tok = tok.strip(string.punctuation)
                if _keyword_ok(tok, sw):
                    combined[tok] = combined.get(tok, 0) + 2
    words = re.findall(r"\b[a-zA-Z]{4,}\b", text.lower())
    freq = Counter(w for w in words if w not in sw)
    for w, cnt in freq.most_common(80):
        if w not in combined:
            combined[w] = cnt
    seen, result = set(), []
    for kw, _ in sorted(combined.items(), key=lambda x: -x[1]):
        if kw not in seen:
            seen.add(kw)
            result.append(kw)
        if len(result) >= top_n:
            break
    return result


def reading_metrics(text: str, language: str = 'en') -> dict:
    import textstat
    words = len(text.split())
    cjk = len(re.findall(r'[\u3400-\u9fff]', text))
    is_cjk = cjk > len(text) * .2
    if not text.strip() or is_cjk or not (language or '').lower().startswith('en'):
        count = cjk if is_cjk else words
        return {'word_count': count, 'reading_time_min': max(1, round(count / (400 if is_cjk else 200))) if count else 0, 'flesch_score': None, 'flesch_kincaid': None, 'smog_index': None}
    textstat.set_lang('en_US')
    return {
        "word_count": words,
        "reading_time_min": max(1, round(words / 200)),
        "flesch_score": round(textstat.flesch_reading_ease(text), 2),
        "flesch_kincaid": round(textstat.flesch_kincaid_grade(text), 2),
        # SMOG was normed on 30-sentence samples. Do not present a library's
        # short-text zero or statistically unsupported estimate as a grade.
        "smog_index": round(textstat.smog_index(text), 2) if textstat.sentence_count(text) >= 30 else None,
    }


def detect_language(text: str) -> str:
    try:
        import langdetect
        return langdetect.detect(text[:1000])
    except Exception:
        return "en"
