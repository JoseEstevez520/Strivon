import json, numpy as np, collections
import pathlib
HERE = pathlib.Path(__file__).resolve().parent
REPO = HERE.parents[1]
F = json.load(open(HERE / "feats.json"))
# ---------- label-free predictions (all parameters fixed before looking at labels) ----------
def rz(vals):
    v = np.array(vals); med = np.median(v); mad = 1.4826 * np.median(np.abs(v - med))
    sc = max(mad, 0.05 * abs(med) + 1e-6); return (v - med) / sc
Z = {}
for aid, d in F.items():
    names = sorted(d); Z[aid] = {}
    cols = {}
    for k in ["edge", "lapvar", "sat", "flat", "dark", "pixdev", "histdev"]:
        x = [d[n][k] for n in names]
        if k == "lapvar": x = list(np.log1p(x))
        cols[k] = rz(x)
    for i, n in enumerate(names):
        Z[aid][n] = {k: float(cols[k][i]) for k in cols}
def s_tex(z): return np.mean([z["edge"], z["lapvar"], -z["flat"]])
def s_all(z): return np.mean([z["edge"], z["lapvar"], -z["flat"], z["sat"], -z["dark"]])
def s_gate(z):  # only trust a low texture score if the crop also looks different from the usual (median) view
    s = s_all(z); return s if (z["pixdev"] > 2 or z["histdev"] > 2) else max(s, 0.0)
TH = {"aggr(-2/-1)": (-2, -1), "mid(-2.5/-1.5)": (-2.5, -1.5), "cons(-3.5/-2)": (-3.5, -2)}
def lvl(s, t):
    return "empty" if s < t[0] else "half" if s < t[1] else "full"
VARS = {}
for sn, sf in [("texture", s_tex), ("tex+colour", s_all), ("tex+colour, change-gated", s_gate)]:
    for tn, t in TH.items():
        VARS[f"{sn} {tn}"] = (sf, t)
# ---------- evaluation ----------
L = json.load(open(REPO / "eval" / "labels.json", encoding="utf-8"))
O = {"empty": 0, "half": 1, "full": 2}
def pts(p, t): return 1 if p == t else (-2 if O[p] < O[t] else -3)
items = [(aid, img, v["stock_level"]) for cam in L for img in L[cam] for aid, v in L[cam][img].items()
         if v.get("stock_level") in O and aid in Z and img in Z[aid]]
missing = sum(1 for cam in L for img in L[cam] for aid, v in L[cam][img].items() if v.get("stock_level") in O) - len(items)
dist = collections.Counter(t for _, _, t in items)
print("labelled areas:", len(items), "missing feats:", missing, "dist:", dict(dist))
base = sum(pts("full", t) for _, _, t in items)
print(f"{'always full':40s} total {base:5d}  per-area {base/len(items):.3f}")
print(f"{'variant':40s} total  per-area  vsBase  nLow nHigh  predDist   confusion(rows truth e/h/f, cols pred e/h/f)")
for name, (sf, t) in VARS.items():
    tot = 0; lo = hi = 0; pc = collections.Counter(); cm = np.zeros((3, 3), int)
    for aid, img, tr in items:
        p = lvl(sf(Z[aid][img]), t); tot += pts(p, tr); pc[p] += 1; cm[O[tr], O[p]] += 1
        lo += O[p] < O[tr]; hi += O[p] > O[tr]
    print(f"{name:40s} {tot:5d}  {tot/len(items):.3f}  {tot-base:+5d}  {lo:4d} {hi:4d}  {dict(pc)}  {cm.tolist()}")
