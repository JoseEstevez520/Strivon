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


# ---- forward split: each camera's last 2 photos (most like the hidden set) ----
FSTART, FEND = "<!-- FORWARD:START -->", "<!-- FORWARD:END -->"
PF = HERE / "benchmark" / "preds_forward"
if B.FORWARD is not None and PF.exists():
    _, ftest = B.forward_train_test()
    frows = []
    for f in sorted(PF.glob("*.json")):
        m = META.get(f.stem, {"approach": f.stem})
        t = B.tally(json.loads(f.read_text(encoding="utf-8")), set(ftest))
        frows.append((t["total"], m, t, f.stem))
    frows.sort(key=lambda r: -r[0])
    fl = ["Forward split: trained without each camera's last 2 photos, tested on them "
          f"({frows[0][2]['areas'] if frows else 0} areas). Files in `eval/benchmark/preds_forward/`, scored with "
          "`python eval/benchmark.py forward <file>`.", "",
          "| # | Approach | Identification | Stock | Below | Above | Total / max | Per area | ≈ / 578 | Seconds per photo |",
          "|---:|---|---:|---:|---:|---:|---:|---:|---:|---|"]
    for rank, (_, m, t, name) in enumerate(frows, 1):
        fl.append(f"| {rank} | {m['approach']} (`{name}`) | {t['ident']:+d} | {t['stock']:+d} | {t['below']} | {t['above']} | "
                  f"{t['total']:+d} / {t['max']} | {t['total'] / t['areas']:+.3f} | {round(t['total'] / t['areas'] * 289):+d} | {m.get('seconds', '')} |")
    ftable = "\n".join(fl)
    for doc in (ROOT / "LEADERBOARD.md", ROOT / "README.md"):
        s2 = doc.read_text(encoding="utf-8")
        if FSTART in s2:
            s2 = re.sub(re.escape(FSTART) + ".*?" + re.escape(FEND), FSTART + "\n" + ftable + "\n" + FEND, s2, flags=re.S)
            doc.write_text(s2, encoding="utf-8")
    print(ftable)
