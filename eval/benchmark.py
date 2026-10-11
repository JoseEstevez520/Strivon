"""The team benchmark: five folds of whole photos, scored with the challenge points. See LEADERBOARD.md.

Usage:
    python eval/benchmark.py folds                   # the fold of every photo
    python eval/benchmark.py score predictions.json  # points table and a leaderboard row
    python eval/benchmark.py forward predictions.json  # score on the forward split (each camera's last 2 photos):
                                                       # labels_v1, the current labels and the areas both agree on

In Python, with eval/ on the path:
    from benchmark import train_test
    train, test = train_test(0)   # lists of (camera, image): fit on train only, predict every area of test

predictions.json holds every photo, each one predicted by a model fitted without that photo's fold
(five runs merged into one file), in the format of eval/labels.json.
"""
import json
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
from score import score_area  # noqa: E402

FOLDS = json.loads((HERE / "benchmark" / "folds.json").read_text(encoding="utf-8"))
KEY = json.loads((HERE / "benchmark" / "labels_v1.json").read_text(encoding="utf-8"))
STOCK = {"empty": 0.0, "half": 0.5, "full": 1.0}


def train_test(fold):
    """(train, test) lists of (camera, image) for fold 0-4."""
    train, test = [], []
    for photo, f in sorted(FOLDS.items()):
        cam, img = photo.split("/")
        (test if f == fold else train).append((cam, img))
    return train, test


FORWARD = json.loads((HERE / "benchmark" / "forward.json").read_text(encoding="utf-8")) if (HERE / "benchmark" / "forward.json").exists() else None


def forward_train_test():
    """Forward split (like the hidden set): test = each camera's last 2 photos, train = the rest."""
    test = {(c, i) for c, imgs in FORWARD["test"].items() for i in imgs}
    photos = [tuple(p.split("/")) for p in sorted(FOLDS)]
    return [p for p in photos if p not in test], sorted(test)


def last_photos():
    """The last photo of the day of each camera."""
    last = {}
    for photo in sorted(FOLDS):
        cam, img = photo.split("/")
        last[cam] = img
    return set(last.items())


def forward_keys():
    """The forward test scored three ways, on labels_v1's areas:

    - "labels_v1": the frozen key.
    - "current": the same areas valued by eval/labels.json. Since labels_v1 was frozen, 32 of the 302 forward stock
      labels changed, most of them in André's review of the evening photos where his model disagreed with the labels
      (PR #61, #75), so this key leans towards his models.
    - "unchanged": only the areas where both keys agree (269), the comparison that no review touched.
    """
    cur = json.loads((HERE / "labels.json").read_text(encoding="utf-8"))
    same = lambda a, b: a["stock_level"] == b["stock_level"] and bool(a["planogram_compliant"]) == bool(b["planogram_compliant"])
    current, unchanged = {}, {}
    for c, i in forward_train_test()[1]:
        for a, v in KEY.get(c, {}).get(i, {}).items():
            n = cur.get(c, {}).get(i, {}).get(a)
            if n is None:
                continue
            current.setdefault(c, {}).setdefault(i, {})[a] = n
            if same(v, n):
                unchanged.setdefault(c, {}).setdefault(i, {})[a] = v
    return {"labels_v1": KEY, "current": current, "unchanged": unchanged}


def tally(preds, photos=None, key=None):
    t = {"areas": 0, "ident_ok": 0, "ident_wrong": 0, "stock_ok": 0, "below": 0, "above": 0, "missing": 0}
    for cam, imgs in (KEY if key is None else key).items():
        for img, areas in imgs.items():
            if photos is not None and (cam, img) not in photos:
                continue
            for area_id, truth in areas.items():
                t["areas"] += 1
                p = preds.get(cam, {}).get(img, {}).get(area_id)
                if p is None:
                    t["missing"] += 1
                    continue
                if "stock_value" not in p:
                    p = dict(p, stock_value=STOCK[p["stock_level"]])
                i, s = score_area(p, truth)
                t["ident_ok" if i == 1 else "ident_wrong"] += 1
                t[{1: "stock_ok", -2: "below", -3: "above"}[s]] += 1
    # a missing area is a wrong identification (-2) and a stock above the real one (-3)
    t["ident"] = t["ident_ok"] - 2 * (t["ident_wrong"] + t["missing"])
    t["stock"] = t["stock_ok"] - 2 * t["below"] - 3 * (t["above"] + t["missing"])
    t["total"] = t["ident"] + t["stock"]
    t["max"] = 2 * t["areas"]
    return t


def report(preds):
    t, last = tally(preds), tally(preds, last_photos())
    rows = [("Identification correct", "ident_ok", 1), ("Identification wrong", "ident_wrong", -2),
            ("Stock level correct", "stock_ok", 1), ("Stock level below the real stock", "below", -2),
            ("Stock level above the real stock", "above", -3), ("Missing area", "missing", -5)]
    print(f"Answer key labels_v1: {t['areas']} areas\n")
    print("| Case | Areas | Points each | Points |")
    print("|---|---:|---:|---:|")
    for name, k, pts in rows:
        print(f"| {name} | {t[k]} | {pts:+d} | {pts * t[k]:+d} |")
    print(f"| Total | | | {t['total']:+d} out of {t['max']} |")
    print(f"\n{t['total'] / t['areas']:+.3f} per area. Last photo of each camera: "
          f"{last['total'] / last['areas']:+.3f} per area ({last['areas']} areas).")
    print("\nLeaderboard row (fill in the approach, owner, labels, other photos and seconds):\n")
    print(f"| approach | owner | labels trained on | no | {t['ident']:+d} | {t['stock']:+d} | "
          f"{t['total']:+d} / {t['max']} | {t['total'] / t['areas']:+.3f} | "
          f"{last['total'] / last['areas']:+.3f} | s/photo, machine |")


if __name__ == "__main__":
    if len(sys.argv) == 2 and sys.argv[1] == "folds":
        print("\n".join(f"{photo} {f}" for photo, f in sorted(FOLDS.items())))
    elif len(sys.argv) == 3 and sys.argv[1] == "forward":
        _, test = forward_train_test()
        preds = json.loads(Path(sys.argv[2]).read_text(encoding="utf-8"))
        for name, key in forward_keys().items():
            t = tally(preds, set(test), key)
            print(f"Forward split, {name} ({t['areas']} areas): {t['total']:+d} / {t['max']}, {t['total'] / t['areas']:+.3f} per area, "
                  f"about {round(t['total'] / t['areas'] * 289):+d} / 578. Identification {t['ident']:+d}, stock {t['stock']:+d} "
                  f"(below {t['below']}, above {t['above']}, missing {t['missing']}).")
    elif len(sys.argv) == 3 and sys.argv[1] == "score":
        report(json.loads(Path(sys.argv[2]).read_text(encoding="utf-8")))
    else:
        print(__doc__)
