# Same variants; (a) score only on the later half of each camera's photos ("forward" subset);
# (b) causal version: per-area robust z computed only from photos up to and including the current one (min 3 photos else predict full).
import json, numpy as np, collections, importlib.util, sys
import pathlib
HERE = pathlib.Path(__file__).resolve().parent
REPO = HERE.parents[1]
F = json.load(open(HERE / "feats.json"))
L = json.load(open(REPO / "eval" / "labels.json", encoding="utf-8"))
O = {"empty": 0, "half": 1, "full": 2}
def pts(p, t): return 1 if p == t else (-2 if O[p] < O[t] else -3)
K = ["edge", "lapvar", "sat", "flat", "dark", "pixdev", "histdev"]
def rzone(hist, x):
    v = np.array(hist); med = np.median(v); mad = 1.4826 * np.median(np.abs(v - med))
    return (x - med) / max(mad, 0.05 * abs(med) + 1e-6)
def zs(aid, img, causal):
    names = sorted(F[aid]); idx = names.index(img)
    use = names[:idx + 1] if causal else names
    if causal and len(use) < 3: return None
    z = {}
    for k in K:
        tf = (lambda a: np.log1p(a)) if k == "lapvar" else (lambda a: a)
        z[k] = rzone([tf(F[aid][n][k]) for n in use], tf(F[aid][img][k]))
    return z
def s_tex(z): return np.mean([z["edge"], z["lapvar"], -z["flat"]])
def s_all(z): return np.mean([z["edge"], z["lapvar"], -z["flat"], z["sat"], -z["dark"]])
def s_gate(z):
    s = s_all(z); return s if (z["pixdev"] > 2 or z["histdev"] > 2) else max(s, 0.0)
TH = {"aggr": (-2, -1), "mid": (-2.5, -1.5), "cons": (-3.5, -2)}
items = [(cam, aid, img, v["stock_level"]) for cam in L for img in L[cam] for aid, v in L[cam][img].items() if v.get("stock_level") in O]
late = set()
for cam in L:
    ims = sorted(L[cam]); late |= {(cam, i) for i in ims[len(ims) // 2:]}
for subset_name, subset in [("all", items), ("later-half", [it for it in items if (it[0], it[2]) in late])]:
    for causal in [False, True]:
        if subset_name == "later-half" and causal is False: pass
        base = sum(pts("full", t) for *_, t in subset)
        row = []
        for sn, sf in [("tex", s_tex), ("tex+col", s_all), ("gated", s_gate)]:
            for tn, t in TH.items():
                tot = 0
                for cam, aid, img, tr in subset:
                    z = zs(aid, img, causal)
                    s = 0.0 if z is None else sf(z)
                    p = "empty" if s < t[0] else "half" if s < t[1] else "full"
                    tot += pts(p, tr)
                row.append(f"{sn}/{tn}:{tot}")
        print(f"{subset_name:10s} causal={causal!s:5s} n={len(subset)} dist={dict(collections.Counter(t for *_, t in subset))} always-full={base}")
        print("   ", "  ".join(row))
