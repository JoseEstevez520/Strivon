"""Combine prediction files: stock from one model (or a vote), product check from another.

Each team member runs their own model on the same photos and writes a file in the submission
format. This merges them, area by area, and checks that nothing is missing.

    python -m sensei combine --stock andre.json --product miguel.json --out final.json
    python -m sensei combine --stock a.json b.json c.json --product m.json j.json l.json --out final.json

Several --stock files: the lower median of their levels (round down on a tie, Sensei: "in case of
doubt it is better to under estimate"). Several --product files: majority vote (ties: the first file).
If an area is missing from every stock file, the first product file's stock is used, so the result
never misses an area.

On the team benchmark (labels_v1): André's fine-tuned DINOv2-base stock + our CLIP product check =
3393-3396 / 3858 (about 508 / 578), the best score that uses only the photo under analysis.
"""
from __future__ import annotations

import json
from pathlib import Path

LEVELS = ["empty", "half", "full"]
VALUE = {"empty": 0.0, "half": 0.5, "full": 1.0}


def _load(p) -> dict:
    return json.loads(Path(p).read_text(encoding="utf-8"))


def _get(d, c, i, a):
    return d.get(c, {}).get(i, {}).get(a)


def combine(stock_files: list, product_files: list) -> tuple[dict, dict]:
    stocks = [_load(p) for p in stock_files]
    products = [_load(p) for p in product_files]
    base = products[0]
    out: dict = {}
    stats = {"areas": 0, "stock_from_fallback": 0}
    # the union of every photo and area seen in any file
    keys = set()
    for d in stocks + products:
        for c, imgs in d.items():
            for i, areas in imgs.items():
                for a in areas:
                    keys.add((c, i, a))
    for c, i, a in sorted(keys):
        stats["areas"] += 1
        levels = sorted(LEVELS.index(x["stock_level"]) for d in stocks if (x := _get(d, c, i, a)))
        if levels:
            lvl = LEVELS[levels[(len(levels) - 1) // 2]]
        else:
            fb = next((x for d in products if (x := _get(d, c, i, a))), None)
            lvl = fb["stock_level"] if fb else "empty"
            stats["stock_from_fallback"] += 1
        votes = [bool(x["planogram_compliant"]) for d in products if (x := _get(d, c, i, a))]
        if votes:
            yes = sum(votes)
            comp = votes[0] if yes * 2 == len(votes) else yes * 2 > len(votes)
        else:
            comp = True  # an empty area is compliant; no product model saw it
        out.setdefault(c, {}).setdefault(i, {})[a] = {"planogram_compliant": bool(comp), "stock_level": lvl, "stock_value": VALUE[lvl]}
    return out, stats
