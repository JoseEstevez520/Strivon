"""Sensei's hint: estimate a continuous fill first, then turn it into empty/half/full with per-product rules.
Stage 1 (estimation): ordinal logistic heads on FROZEN DINOv2-small features (blocks 4 and 8 are identical to the
pretrained ones in every deployed model, so no label from any photo is baked into them). fill = 0.5 P(>=half) + 0.5 P(full).
Stage 2 (calibration): thresholds t1 < t2 per product family, fitted on out-of-fold fills of the TRAINING photos to
maximise the challenge points (+1 / -2 below / -3 above); families with few areas fall back to the global thresholds.
Scored on the forward split (each camera's last 2 photos never used for fitting)."""
import json, sys, numpy as np
from collections import defaultdict
from sklearn.linear_model import LogisticRegression
from sklearn.preprocessing import StandardScaler
S, REPO = sys.argv[1], sys.argv[2]
F = np.load(S + "/lf/F.npy"); keys = [tuple(k) for k in json.load(open(S + "/lf/keys.json"))]
L = json.load(open(REPO + "/eval/labels.json"))
fwd = json.load(open(REPO + "/eval/benchmark/forward.json"))["test"]
fam = json.load(open(REPO + "/agents/models/stock_4e/deploy/onepass_s224_ld6ee_mix.json"))["planned_family"]
test_imgs = {(c, i if i.endswith(".jpg") else i + ".jpg") for c, ims in fwd.items() for i in ims}
V = {"empty": 0, "half": 1, "full": 2}; NAME = ["empty", "half", "full"]
y = np.array([V[L[c][f][a]["stock_level"]] if a in L.get(c, {}).get(f, {}) else -1 for c, f, a in keys])
is_test = np.array([(c, f) in test_imgs for c, f, _ in keys]); fams = np.array([fam.get(a, "?") for _, _, a in keys])
img_id = np.array([hash((c, f)) % 10**9 for c, f, _ in keys])
tr = (~is_test) & (y >= 0)
X = StandardScaler().fit(F[tr]).transform(F)
def fit_predict(Xtr, ytr, Xte, C):
    a = LogisticRegression(C=C, max_iter=3000).fit(Xtr, ytr >= 1).predict_proba(Xte)[:, 1]
    b = LogisticRegression(C=C, max_iter=3000).fit(Xtr, ytr == 2).predict_proba(Xte)[:, 1]
    b = np.minimum(a, b); return a, b
def pts(pred, true):
    return int(((pred == true) * 1 + (pred < true) * -2 + (pred > true) * -3).sum())
# grouped out-of-fold fills on the training photos (5 folds by photo)
tr_idx = np.where(tr)[0]; groups = np.unique(img_id[tr_idx]); rng = np.random.RandomState(0); rng.shuffle(groups)
fold_of = {g: k % 5 for k, g in enumerate(groups)}; folds = np.array([fold_of[img_id[i]] for i in tr_idx])
best = None
for C in (0.003, 0.01, 0.03, 0.1):
    oa, ob = np.zeros(len(tr_idx)), np.zeros(len(tr_idx))
    for k in range(5):
        m = folds == k
        oa[m], ob[m] = fit_predict(X[tr_idx[~m]], y[tr_idx[~m]], X[tr_idx[m]], C)
    pe, ph, pf = 1 - oa, oa - ob, ob
    PAY = np.array([[1, -2, -2], [-3, 1, -2], [-3, -3, 1]], float)
    dec = np.argmax(np.stack([pe, ph, pf], 1) @ PAY.T, 1)
    s = pts(dec, y[tr_idx]); print(f"C={C}: out-of-fold stock points on training photos {s} / {len(tr_idx)}", flush=True)
    if best is None or s > best[0]: best = (s, C, oa, ob)
_, C, oa, ob = best; oof_fill = 0.5 * oa + 0.5 * ob; ytr = y[tr_idx]; ftr = fams[tr_idx]
grid = np.round(np.arange(0.02, 1.0, 0.02), 2)
def fit_thr(fill, yy):
    bestp, bt = None, (0.2, 0.7)
    for i, t1 in enumerate(grid):
        for t2 in grid[i:]:
            p = pts(np.where(fill < t1, 0, np.where(fill < t2, 1, 2)), yy)
            if bestp is None or p > bestp: bestp, bt = p, (float(t1), float(t2))
    return bt
glob_t = fit_thr(oof_fill, ytr); print("global thresholds (from out-of-fold fills):", glob_t, "C =", C, flush=True)
fam_t = {}
for fname in np.unique(ftr):
    m = ftr == fname
    if m.sum() >= 30 and len(np.unique(ytr[m])) > 1: fam_t[fname] = fit_thr(oof_fill[m], ytr[m])
print("per-family thresholds for", len(fam_t), "families:", {k: v for k, v in list(fam_t.items())[:8]}, "...", flush=True)
# final fit on all training photos, predict the forward photos
a, b = fit_predict(X[tr], y[tr], X[is_test], C); fill = 0.5 * a + 0.5 * b
te = np.where(is_test)[0]
comp_src = json.load(open(REPO + "/eval/benchmark/preds_forward/agents_R3mix_s1.json"))
def write(name, levels, fills=None):
    out = {}
    for j, i in enumerate(te):
        c, f, aid = keys[i]
        e = {"planogram_compliant": comp_src[c][f][aid]["planogram_compliant"], "stock_level": NAME[levels[j]], "stock_value": [0, 0.5, 1][levels[j]]}
        if fills is not None: e["fill_raw"] = round(float(fills[j]), 4)
        out.setdefault(c, {}).setdefault(f, {})[aid] = e
    json.dump(out, open(f"{S}/hint/preds/{name}.json", "w"))
PAY = np.array([[1, -2, -2], [-3, 1, -2], [-3, -3, 1]], float)
write("hint_argmax_points", np.argmax(np.stack([1 - a, a - b, b], 1) @ PAY.T, 1), fill)
write("hint_global_thresholds", np.where(fill < glob_t[0], 0, np.where(fill < glob_t[1], 1, 2)), fill)
lv = [0 if fill[j] < fam_t.get(fams[i], glob_t)[0] else 1 if fill[j] < fam_t.get(fams[i], glob_t)[1] else 2 for j, i in enumerate(te)]
write("hint_per_product_thresholds", np.array(lv), fill)
json.dump({"C": C, "global": glob_t, "per_family": fam_t}, open(S + "/hint/calibration_default.json", "w"), indent=1)
# the new options on GitHub, applied to the submission model's forward probabilities (R3mix, both seeds)
for seed in (0, 1):
    src = json.load(open(f"{REPO}/eval/benchmark/preds_forward/agents_R3mix_s{seed}.json"))
    rows = [(c, f, aid, np.array(src[c][f][aid]["p_stock"])) for c in src for f in src[c] for aid in src[c][f]]
    def emit(name, fn):
        out = {}
        for c, f, aid, p in rows:
            lvl = fn(p); out.setdefault(c, {}).setdefault(f, {})[aid] = {"planogram_compliant": src[c][f][aid]["planogram_compliant"], "stock_level": NAME[lvl], "stock_value": [0, 0.5, 1][lvl]}
        json.dump(out, open(f"{S}/hint/preds/{name}_s{seed}.json", "w"))
    for mode, (E, Fw) in {"andre_mode_sensei": (1, 1), "andre_mode_empty_only_when_bare": (0.4, 1), "andre_mode_empty_at_a_few": (2.5, 1), "andre_mode_strict_full": (1, 0.5)}.items():
        emit(mode, lambda p, E=E, Fw=Fw: int(np.argmax(PAY @ (p * np.array([E, 1, Fw])))))
    fillp = lambda p: p[1] * 0.5 + p[2]
    emit("jose_app_default_0.2_0.7", lambda p: 0 if fillp(p) < 0.2 else 1 if fillp(p) < 0.7 else 2)
    emit("jose_profile_strict_full80", lambda p: 2 if fillp(p) >= 0.8 else 1 if fillp(p) >= 0.8 / 3 else 0)
    emit("jose_profile_relaxed_full40", lambda p: 2 if fillp(p) >= 0.4 else 1 if fillp(p) >= 0.4 / 3 else 0)
print("written", flush=True)
