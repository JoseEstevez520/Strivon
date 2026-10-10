"""Re-score every predictions file in eval/benchmark/preds/ and rewrite the leaderboard tables.

Usage: python eval/leaderboard.py

Each predictions file needs a row in eval/benchmark/preds/meta.json (approach, owner, labels,
other photos, seconds per photo). The table goes between the LEADERBOARD markers in both
LEADERBOARD.md and README.md, best total first.
"""
import json
import re
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent
sys.path.insert(0, str(HERE))
import benchmark as B  # noqa: E402

PREDS = HERE / "benchmark" / "preds"
META = json.loads((PREDS / "meta.json").read_text(encoding="utf-8"))
START, END = "<!-- LEADERBOARD:START -->", "<!-- LEADERBOARD:END -->"


def baseline():
    """Always "right product, full": the rules' trivial answer."""
    return {c: {i: {a: {"planogram_compliant": True, "stock_level": "full", "stock_value": 1.0} for a in ar}
                for i, ar in imgs.items()} for c, imgs in B.KEY.items()}


rows = []
for name, meta in META.items():
    f = PREDS / f"{name}.json"
    preds = baseline() if name == "baseline" else json.loads(f.read_text(encoding="utf-8")) if f.exists() else None
    if preds is None:
        print(f"skip {name}: {f.name} not found")
        continue
    t, last = B.tally(preds), B.tally(preds, B.last_photos())
    rows.append((t["total"], meta, t, last, name))
rows.sort(key=lambda r: -r[0])

n_areas = rows[0][2]["areas"] if rows else 0
lines = [f"Answer key `labels_v1`: {n_areas} areas, maximum {2 * n_areas} points. "
         "\"≈ /578\" scales the total to the 289 hidden validation areas.", "",
         "| # | Approach | Owner | Labels trained on | Looks at other photos? | Identification | Stock | Total / max | ≈ / 578 | Per area | Last photo, per area | Seconds per photo |",
         "|---:|---|---|---|---|---:|---:|---:|---:|---:|---:|---|"]
for rank, (_, m, t, last, name) in enumerate(rows, 1):
    lines.append(f"| {rank} | {m['approach']} (`{name}`) | {m.get('owner', '')} | {m.get('labels', '')} | {m.get('other_photos', 'no')} | "
                 f"{t['ident']:+d} | {t['stock']:+d} | {t['total']:+d} / {t['max']} | {round(t['total'] / t['areas'] * 289):+d} | "
                 f"{t['total'] / t['areas']:+.3f} | {last['total'] / last['areas']:+.3f} | {m.get('seconds', '')} |")
table = "\n".join(lines)

for doc in (ROOT / "LEADERBOARD.md", ROOT / "README.md"):
    s = doc.read_text(encoding="utf-8")
    if START in s:
        s = re.sub(re.escape(START) + ".*?" + re.escape(END), START + "\n" + table + "\n" + END, s, flags=re.S)
    else:
        print(f"no markers in {doc.name}, add {START} ... {END} where the table should go")
        continue
    doc.write_text(s, encoding="utf-8")
sys.stdout.reconfigure(encoding="utf-8")
print(table)
