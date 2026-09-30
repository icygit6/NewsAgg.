"""Full-document, evidence-preserving extractive summaries (no invented facts)."""
from __future__ import annotations
import math
import re
from collections import Counter
from core import semantic

STOP = set('the a an and or of to in is are was were for on with as at by from that this it be has have will said says'.split())

def sentences(text):
    # Keep decimals, honorifics and closing quotation marks attached.
    rows, start = [], 0
    for match in re.finditer(r'[。！？]|[.!?][\u201d\u2019"\']?(?=\s)|\n{2,}', text):
        end = match.end()
        prefix = text[start:end]
        if re.search(r'\b(?:Dr|Mr|Mrs|Ms|Prof|Sr|Jr|St|vs|No|e\.g|i\.e|U\.S)\.$', prefix, re.I) or re.search(r'\b[A-Z]\.$', prefix):
            continue
        rows.append(prefix.strip())
        start = end
    rows.append(text[start:].strip())
    return list(dict.fromkeys(s for s in rows if len(s) >= 25 and not re.match(r'^(Image caption,|Courtesy of|Photo credit:)', s, re.I)))

def tokens(text):
    return [w for w in re.findall(r'[a-z]{2,}|[\u3400-\u9fff]', text.lower()) if w not in STOP]

def summarize(text, language='en', title=''):
    rows = sentences(text)
    if len(rows) > 160:
        rows = [rows[round(i * (len(rows) - 1) / 159)] for i in range(160)]
    if not rows:
        return {'text': None, 'method': 'unavailable', 'evidence': []}
    counts = [Counter(tokens(s)) for s in rows]
    df = Counter(w for c in counts for w in c)
    vectors = [{w: n * (1 + math.log((len(rows) + 1) / (df[w] + 1))) for w, n in c.items()} for c in counts]
    norms = [math.sqrt(sum(v*v for v in c.values())) or 1 for c in vectors]
    def similarity(i, j):
        return sum(v * vectors[j].get(w, 0) for w, v in vectors[i].items()) / (norms[i] * norms[j])
    method = 'extractive-tfidf-mmr-v4'
    embeddings = semantic.embed(rows)
    if embeddings:
        norms_e = [math.sqrt(sum(v*v for v in row)) or 1 for row in embeddings]
        def similarity(i, j):
            return sum(a*b for a,b in zip(embeddings[i], embeddings[j])) / (norms_e[i] * norms_e[j])
        method = 'extractive-bge-m3-mmr-v4'
    sims = [[similarity(i,j) for j in range(len(rows))] for i in range(len(rows))]
    title_words = set(tokens(title))
    relevance = [sum(sims[i]) / len(rows) + .15 * len(title_words & set(counts[i])) / max(1, len(title_words)) for i in range(len(rows))]
    chosen, used = [], 0
    limit = 600 if language.startswith('zh') else 1100
    # Anchor the excerpts with the opening context, then select diverse
    # evidence from across the document rather than four isolated quotes.
    if len(rows[0]) <= limit // 2:
        chosen, used = [0], len(rows[0]) + 1
    while len(chosen) < min(4, len(rows)):
        available = [i for i in range(len(rows)) if i not in chosen and used + len(rows[i]) + 1 <= limit]
        if not available:
            break
        def score(i):
            redundancy = max((sims[i][j] for j in chosen), default=0)
            new_section = not any(min(2, i*3//len(rows)) == min(2, j*3//len(rows)) for j in chosen)
            return relevance[i] - .5 * redundancy + (.12 if new_section else 0)
        best = max(available, key=score)
        chosen.append(best)
        used += len(rows[best]) + 1
    evidence = [rows[i] for i in sorted(chosen)]
    return {'text': '\n'.join(evidence) or None, 'method': method if evidence else 'unavailable', 'evidence': evidence}

def build_ai_summary(text, language='en'):
    return summarize(text, language)['text']
