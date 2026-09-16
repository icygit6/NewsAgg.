"""Evaluate NewsAgg sentiment models against a human-labelled JSONL file.

Each line must contain: {"text": "...", "topic": "Business",
"language": "en", "label": "neutral"}. No example/fake labels are bundled;
the report is meaningful only with independently annotated real articles.
"""
from __future__ import annotations

import argparse
import json
from collections import Counter
from pathlib import Path

from core.nlp import analyze_sentiment

LABELS = ("positive", "neutral", "negative")


def f1_for(label: str, truth: list[str], predictions: list[str]) -> float:
    tp = sum(t == label and p == label for t, p in zip(truth, predictions))
    fp = sum(t != label and p == label for t, p in zip(truth, predictions))
    fn = sum(t == label and p != label for t, p in zip(truth, predictions))
    precision = tp / (tp + fp) if tp + fp else 0.0
    recall = tp / (tp + fn) if tp + fn else 0.0
    return 2 * precision * recall / (precision + recall) if precision + recall else 0.0


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("dataset", type=Path, help="Human-labelled JSONL dataset")
    args = parser.parse_args()
    rows = [json.loads(line) for line in args.dataset.read_text(encoding="utf-8").splitlines() if line.strip()]
    if not rows:
        raise SystemExit("Dataset is empty")

    truth: list[str] = []
    predictions: list[str] = []
    models = Counter()
    for index, row in enumerate(rows, start=1):
        label = str(row.get("label", "")).lower()
        if label not in LABELS or not str(row.get("text", "")).strip():
            raise SystemExit(f"Invalid row {index}: label/text is missing")
        result = analyze_sentiment(
            str(row["text"]), str(row.get("topic") or "World"), str(row.get("language") or "en")
        )
        truth.append(label)
        predictions.append(result["type"])
        models[result["model"]] += 1

    correct = sum(t == p for t, p in zip(truth, predictions))
    f1_scores = {label: f1_for(label, truth, predictions) for label in LABELS}
    confusion = {
        actual: {predicted: sum(t == actual and p == predicted for t, p in zip(truth, predictions))
                 for predicted in LABELS}
        for actual in LABELS
    }
    report = {
        "samples": len(rows),
        "accuracy": round(correct / len(rows), 4),
        "macro_f1": round(sum(f1_scores.values()) / len(LABELS), 4),
        "per_label_f1": {key: round(value, 4) for key, value in f1_scores.items()},
        "confusion_matrix": confusion,
        "model_usage": dict(models),
    }
    print(json.dumps(report, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
