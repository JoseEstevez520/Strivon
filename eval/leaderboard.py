"""Re-score every predictions file in eval/benchmark/preds/ and rewrite the leaderboard tables.

Usage: python eval/leaderboard.py

Each predictions file needs a row in eval/benchmark/preds/meta.json (approach, owner, labels,
other photos, seconds per photo). The table goes between the LEADERBOARD markers in
LEADERBOARD.md, best total first.
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

for doc in (ROOT / "LEADERBOARD.md",):
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
    keys = B.forward_keys()
    frows = []
    for f in sorted(PF.glob("*.json")):
        m = META.get(f.stem, {"approach": f.stem})
        preds = json.loads(f.read_text(encoding="utf-8"))
        t = {name: B.tally(preds, set(ftest), key) for name, key in keys.items()}
        frows.append((t["unchanged"]["total"], m, t, f.stem))
    frows.sort(key=lambda r: -r[0])
    n = {name: B.tally({}, set(ftest), key)["areas"] for name, key in keys.items()}
    fl = [f"Forward split: trained without each camera's last 2 photos, tested on them ({n['labels_v1']} areas). Since `labels_v1` "
          f"was frozen, {n['labels_v1'] - n['unchanged']} of these areas changed in `eval/labels.json`, most of them in André's "
          "review of the evening photos where his model disagreed with the labels (PR #61, #75). So `labels_v1` is stale there "
          f"and the current labels lean towards his models. The table is sorted by the {n['unchanged']} areas where both keys "
          "agree, which no review touched. Files in `eval/benchmark/preds_forward/`, scored with "
          "`python eval/benchmark.py forward <file>` (all three keys).", "",
          f"| # | Approach | Unchanged areas: total / max | Per area | ≈ / 578 | Identification | Stock | Below | Above | "
          f"`labels_v1`: total / {2 * n['labels_v1']} | Current labels: total / {2 * n['current']} | Seconds per photo |",
          "|---:|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---|"]
    for rank, (_, m, t, name) in enumerate(frows, 1):
        u = t["unchanged"]
        fl.append(f"| {rank} | {m['approach']} (`{name}`) | {u['total']:+d} / {u['max']} | {u['total'] / u['areas']:+.3f} | "
                  f"{round(u['total'] / u['areas'] * 289):+d} | {u['ident']:+d} | {u['stock']:+d} | {u['below']} | {u['above']} | "
                  f"{t['labels_v1']['total']:+d} | {t['current']['total']:+d} | {m.get('seconds', '')} |")
    ftable = "\n".join(fl)
    for doc in (ROOT / "LEADERBOARD.md",):
        s2 = doc.read_text(encoding="utf-8")
        if FSTART in s2:
            s2 = re.sub(re.escape(FSTART) + ".*?" + re.escape(FEND), FSTART + "\n" + ftable + "\n" + FEND, s2, flags=re.S)
            doc.write_text(s2, encoding="utf-8")
    print(ftable)
