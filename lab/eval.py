"""Local measurement harness (experiment lane, not for the shared repo).

Joins the team's labels with the pipeline's per-area observations and scores several policies with the
official points: stock +1 correct, -2 below the real level, -3 above; compliance +1 / -2.
Calibrated policies are evaluated leave-one-camera-out.
"""
import json
import sys
from collections import Counter, defaultdict

import numpy as np
from sklearn.linear_model import LogisticRegression

LEVELS = ["empty", "half", "full"]
VAL = {"empty": 0.0, "half": 0.5, "full": 1.0}
# POINTS[pred][true]
POINTS = np.array([[1, -2, -2], [-3, 1, -2], [-3, -3, 1]], dtype=float)


def stock_points(pred, true):
    return float(POINTS[LEVELS.index(pred), LEVELS.index(true)])


def load(labels_path="lab/labels.json", state_path="lab/state.json"):
    L = json.load(open(labels_path))
    O = json.load(open(state_path))["observations"]
    order = {c: sorted(imgs) for c, imgs in O.items()}
    rows = []
    for cam, imgs in L.items():
        for img, areas in imgs.items():
            for aid, gt in areas.items():
                o = O.get(cam, {}).get(img, {}).get(aid)
                if o is None:
                    continue
                n = order[cam].index(img) + 1
                rows.append(dict(cam=cam, img=img, aid=aid, n=n, gt=gt, o=o))
    return rows


def features(o):
    p = np.clip(np.array(o["p_stock"], float), 1e-4, 1)
    return np.concatenate([np.log(p), [o["container_frac"]]])


def decide(probs):
    """Choose the answer with the highest expected points under the official matrix."""
    ev = POINTS @ probs  # ev[pred] = sum_true P[true] * POINTS[pred][true]
    return LEVELS[int(np.argmax(ev))]


def loco_calibrated(rows, C=1.0):
    cams = sorted({r["cam"] for r in rows})
    preds = {}
    for held in cams:
        tr = [r for r in rows if r["cam"] != held]
        te = [r for r in rows if r["cam"] == held]
        if not te or len({r["gt"]["stock_level"] for r in tr}) < 2:
            continue
        X = np.array([features(r["o"]) for r in tr])
        y = np.array([LEVELS.index(r["gt"]["stock_level"]) for r in tr])
        clf = LogisticRegression(C=C, max_iter=2000).fit(X, y)
        Xt = np.array([features(r["o"]) for r in te])
        P = np.zeros((len(te), 3))
        P[:, clf.classes_] = clf.predict_proba(Xt)
        for r, p in zip(te, P):
            preds[(r["cam"], r["img"], r["aid"])] = (decide(p), p)
    return preds


def policy_score(rows, fn):
    s = 0.0
    n = 0
    for r in rows:
        p = fn(r)
        if p is None:
            continue
        s += stock_points(p, r["gt"]["stock_level"])
        n += 1
    return s, n


def bucket(n):
    return "1-4" if n <= 4 else "5-8" if n <= 8 else "9-13"


def main():
    rows = load()
    print(f"labelled areas joined with observations: {len(rows)}")
    truth = Counter(r["gt"]["stock_level"] for r in rows)
    print("truth:", dict(truth))
    cal = loco_calibrated(rows)
    rows_c = [r for r in rows if (r["cam"], r["img"], r["aid"]) in cal]
    print(f"rows scored by the leave-one-camera-out calibration: {len(rows_c)}\n")

    policies = {
        "always full": lambda r: "full",
        "always half": lambda r: "half",
        "current model": lambda r: r["o"]["stock_level"],
        "calibrated LOCO": lambda r: cal[(r["cam"], r["img"], r["aid"])][0],
    }
    print("stock points per area (higher is better, max 1.0)")
    for name, fn in policies.items():
        s, n = policy_score(rows_c, fn)
        print(f"  {name:18s} {s / n:+.3f}   total {s:+.0f} over {n}")

    print("\nby photo order bucket")
    for b in ("1-4", "5-8", "9-13"):
        sub = [r for r in rows_c if bucket(r["n"]) == b]
        if not sub:
            continue
        line = [f"{b:5s} n={len(sub):4d}"]
        for name, fn in policies.items():
            s, n = policy_score(sub, fn)
            line.append(f"{name.split()[0][:6]}:{s / n:+.2f}")
        print("  " + "  ".join(line))

    print("\nconfusion of calibrated LOCO (true -> predicted)")
    cm = defaultdict(Counter)
    for r in rows_c:
        cm[r["gt"]["stock_level"]][cal[(r["cam"], r["img"], r["aid"])][0]] += 1
    for t in LEVELS:
        print(f"  {t:5s} n={sum(cm[t].values()):4d}", {p: cm[t][p] for p in LEVELS})

    print("\nper camera: calibrated minus always-full (points per area)")
    bycam = defaultdict(list)
    for r in rows_c:
        bycam[r["cam"]].append(r)
    diffs = {}
    for c, sub in sorted(bycam.items()):
        a, n = policy_score(sub, policies["calibrated LOCO"])
        b, _ = policy_score(sub, policies["always full"])
        diffs[c] = (a - b) / n
        print(f"  {c}  n={n:3d}  {diffs[c]:+.2f}")
    rng = np.random.default_rng(0)
    cams = list(bycam)
    boots = []
    for _ in range(2000):
        pick = rng.choice(cams, len(cams))
        a = sum(policy_score(bycam[c], policies["calibrated LOCO"])[0] for c in pick)
        b = sum(policy_score(bycam[c], policies["always full"])[0] for c in pick)
        n = sum(len(bycam[c]) for c in pick)
        boots.append((a - b) / n)
    lo, hi = np.percentile(boots, [2.5, 97.5])
    print(f"\ncalibrated - always full: mean {np.mean(boots):+.3f} per area, 95% CI [{lo:+.3f}, {hi:+.3f}] (bootstrap over cameras)")


if __name__ == "__main__":
    main()
