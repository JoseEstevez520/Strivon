import pathlib
HERE = pathlib.Path(__file__).resolve().parent
REPO = HERE.parents[1]
import sys, json, numpy as np
S = sys.argv[1]
F = np.load(S + "/lf/F.npy"); keys = json.load(open(S + "/lf/keys.json"))
L = json.load(open(REPO / "eval" / "labels.json"))
V = {"empty": 0, "half": 1, "full": 2}
y = np.array([V[L[c][f][a]["stock_level"]] if a in L.get(c, {}).get(f, {}) else -1 for c, f, a in keys])
area = np.array([a for _, _, a in keys]); ts = np.array([int(f[:-4]) for _, f, _ in keys])
def pts(pred, mask):
    t, p = y[mask], pred[mask]
    return int(((p == t) * 1 + (p < t) * -2 + (p > t) * -3).sum()), int((p < t).sum()), int((p > t).sum())
def score(Fx, causal=False):
    Xn = Fx / np.linalg.norm(Fx, axis=1, keepdims=True)
    z = np.zeros(len(keys))
    for a in np.unique(area):
        idx = np.where(area == a)[0]
        for i in idx:
            ref = idx[ts[idx] < ts[i]] if causal else idx
            if len(ref) < 3: z[i] = 0; continue
            med = np.median(Xn[ref], 0); med /= np.linalg.norm(med)
            d_ref = 1 - Xn[ref] @ med; d = 1 - Xn[i] @ med
            mad = max(np.median(np.abs(d_ref - np.median(d_ref))), 0.05 * np.median(d_ref) + 1e-6)
            z[i] = (d - np.median(d_ref)) / (1.4826 * mad)
    return z
mask = y >= 0
print("n", mask.sum(), "always full", pts(np.full(len(y), 2), mask))
blocks = {"b8 cls+mean": F[:, :768], "b8 mean": F[:, 384:768], "b4 mean": F[:, 768:], "b8+b4": F}
for causal in (False, True):
    for name, Fx in blocks.items():
        z = score(Fx, causal)
        for tn, (te, th) in {"aggr": (2, 1), "mid": (2.5, 1.5), "cons": (3.5, 2)}.items():
            pred = np.where(z > te * 1.0 + 0 if False else z > th, 1, 2)
            pred = np.where(z > th, 1, 2); pred = np.where(z > te + (th if False else 0) + 1.5, 0, pred) if False else pred
            # empty if z > 2*te (far), half if z > th
            pred = np.where(z > 2 * te, 0, np.where(z > th, 1, 2))
            print(("causal " if causal else "fullday ") + f"{name:12s} {tn}: {pts(pred, mask)}")
