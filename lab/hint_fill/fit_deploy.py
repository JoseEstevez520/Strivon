"""Fit the hint model's two ordinal heads on ALL labelled areas (frozen DINOv2-small blocks 4+8 features) -> hint_heads.npz.
Features come from extract_features.py (F.npy + keys.json). Usage: python lab/hint_fill/fit_deploy.py FEATURE_DIR"""
import json, sys, pathlib, numpy as np
from sklearn.linear_model import LogisticRegression
HERE = pathlib.Path(__file__).resolve().parent; REPO = HERE.parents[1]
D = sys.argv[1]
F = np.load(D + "/F.npy"); keys = json.load(open(D + "/keys.json"))
L = json.load(open(REPO / "eval" / "labels.json"))
V = {"empty": 0, "half": 1, "full": 2}
y = np.array([V[L[c][f][a]["stock_level"]] if a in L.get(c, {}).get(f, {}) else -1 for c, f, a in keys]); m = y >= 0
mu, sd = F[m].mean(0), F[m].std(0) + 1e-6; X = (F[m] - mu) / sd
ha = LogisticRegression(C=0.1, max_iter=5000).fit(X, y[m] >= 1); hb = LogisticRegression(C=0.1, max_iter=5000).fit(X, y[m] == 2)
np.savez(HERE / "hint_heads.npz", mu=mu, sd=sd, wa=ha.coef_[0], ba=ha.intercept_, wb=hb.coef_[0], bb=hb.intercept_)
print("fitted on", int(m.sum()), "areas ->", HERE / "hint_heads.npz")
