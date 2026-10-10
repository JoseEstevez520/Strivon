"""Image-only Strivon model (lane I): stock = x01 blend, compliance = p01 HSV bank. Self-contained port for predict.py.

Stock (exp_x01_noclip_blend.py): 85 features per area = 28 pixel features of the planogram quad crop at expand 1.0
+ 28 at expand 1.6 (exp_a_feats.crop_feats, 96x96 homography crops) + 28 of the hand-drawn crate quad crop
(exp_e_feats, lab/cache/crates.json) + the shared-crate flag. P = 0.5 * standardised multinomial logistic (C picked by
inner leave-one-camera-out on the official points) + 0.5 * HistGradientBoosting; the level is eval.decide(P).
Compliance (exp_p01_comp.py, FEAT=hsv, MODE=lr): 48-value Hellinger HS histogram of the 48x48 area crop; per slot a
bank of training crops (compliant and non-compliant); features = distance to the nearest compliant crop, that minus the
distance to the nearest non-compliant crop, and whether the slot has non-compliant references; logistic regression
trained on inner-split features (benchmark folds), non-compliant iff P > 1/2.

At inference only the photo being predicted is read. Assets: the model file (weights, crate quads, area-to-crate map,
HSV bank, planogram quads) and nothing else.
"""
import json
import os
import sys
import time

import cv2
import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
sys.path.insert(0, HERE)
import eval as E  # noqa: E402  (lab/eval.py: LEVELS, POINTS, decide)

SIZE = (96, 96)
HSV_SIZE = (48, 48)
EXPANDS = (1.0, 1.6)
CS = [0.003, 0.01, 0.03, 0.1, 0.3, 1.0]
VAL = {"empty": 0.0, "half": 0.5, "full": 1.0}
N_STOCK = 85


class PredictError(RuntimeError):
    pass


# ---------------------------------------------------------------- geometry
def planogram_quads(path):
    p = json.load(open(path))["Frutas e Legumes"]["cameras"]
    out = {}
    for c in p.values():
        for a in c["products"]:
            k = a["image_coordinates"]
            out[a["area_id"]] = np.array([k[n] for n in ("top_left", "top_right", "bottom_right", "bottom_left")],
                                         np.float32)
    return out


def _warp(im, q, size):
    dst = np.array([[0, 0], [size[0], 0], [size[0], size[1]], [0, size[1]]], np.float32)
    M = cv2.getPerspectiveTransform(q, dst)
    return cv2.warpPerspective(im, M, size, borderMode=cv2.BORDER_REFLECT)


def area_crop(im, q, size, expand=1.0):
    """Same as common.crop: expand>1 enlarges the quad around its centre."""
    if expand != 1.0:
        c = q.mean(0)
        q = c + (q - c) * expand
    return _warp(im, q, size)


# ---------------------------------------------------------------- features (verbatim from exp_a_feats / exp_k01)
def _masks(hsv):
    h, s, v = hsv[..., 0].astype(int), hsv[..., 1].astype(int), hsv[..., 2].astype(int)
    teal = (h >= 70) & (h <= 105) & (s >= 60) & (v >= 40)
    dark = v < 55
    grey = (s < 40) & (v >= 55) & (v < 215)
    brown = (h >= 5) & (h <= 22) & (s >= 35) & (s < 130) & (v >= 70) & (v < 220)
    return teal, dark, grey, brown


def crop_feats(c):
    hsv = cv2.cvtColor(c, cv2.COLOR_BGR2HSV)
    teal, dark, grey, brown = _masks(hsv)
    bg = teal | dark | grey
    H = c.shape[0]
    top, bot = slice(0, H // 2), slice(H // 2, H)
    f = []
    for m in (teal, dark, grey, brown, bg):
        f += [m.mean(), m[top].mean(), m[bot].mean()]
    k = np.ones((5, 5), np.uint8)
    bo = cv2.morphologyEx(bg.astype(np.uint8), cv2.MORPH_OPEN, k)
    n, _, st, _ = cv2.connectedComponentsWithStats(bo, 8)
    f.append(st[1:, cv2.CC_STAT_AREA].max() / bo.size if n > 1 else 0.0)
    tb = cv2.morphologyEx(teal.astype(np.uint8), cv2.MORPH_OPEN, k)
    n, _, st, _ = cv2.connectedComponentsWithStats(tb, 8)
    f.append(st[1:, cv2.CC_STAT_AREA].max() / tb.size if n > 1 else 0.0)
    g = cv2.cvtColor(c, cv2.COLOR_BGR2GRAY)
    e = cv2.Canny(g, 60, 150) > 0
    f += [e.mean(), e[top].mean(), e[bot].mean()]
    lap = cv2.Laplacian(g, cv2.CV_32F)
    f.append(float(np.log1p(lap.var())))
    s, v = hsv[..., 1] / 255.0, hsv[..., 2] / 255.0
    prod = (~bg) & (s > 0.35)
    f += [s.mean(), s.std(), v.mean(), v.std(), prod.mean(), prod[top].mean(), prod[bot].mean()]
    return [float(x) for x in f]


def hsv_feat(im, q):
    c = area_crop(im, q, HSV_SIZE)
    hsv = cv2.cvtColor(c, cv2.COLOR_BGR2HSV)
    h = cv2.calcHist([hsv], [0, 1], None, [12, 4], [0, 180, 0, 256]).ravel()
    h /= h.sum() + 1e-9
    return np.sqrt(h)


def photo_features(im, aids, geo, timer=None):
    """Per area of one photo: (polygon 56, crate 28, shared 1) stock row and the 48-value HSV row.
    geo: dict with quads, crate_quads, a2c, shared. timer: optional Timer to split the stages."""
    t = timer or Timer()
    with t("poly"):
        poly = {a: crop_feats(area_crop(im, geo["quads"][a], SIZE, 1.0)) + crop_feats(area_crop(im, geo["quads"][a], SIZE, 1.6))
                for a in aids}
    with t("crate"):
        crates = sorted({geo["a2c"][a] for a in aids})
        cf = {c: crop_feats(_warp(im, geo["crate_quads"][c], SIZE)) for c in crates}
    X = np.array([poly[a] + cf[geo["a2c"][a]] + [geo["shared"][a]] for a in aids], float)
    with t("hsv"):
        Hh = np.array([hsv_feat(im, geo["quads"][a]) for a in aids], float)
    return X, Hh


class Timer:
    """Wall and process-CPU seconds per named stage."""

    def __init__(self):
        self.wall, self.cpu = {}, {}

    def __call__(self, name):
        tm = self

        class _Ctx:
            def __enter__(self):
                self.w, self.c = time.perf_counter(), time.process_time()

            def __exit__(self, *exc):
                tm.wall[name] = tm.wall.get(name, 0.0) + time.perf_counter() - self.w
                tm.cpu[name] = tm.cpu.get(name, 0.0) + time.process_time() - self.c
        return _Ctx()


# ---------------------------------------------------------------- geometry assets
def load_geo(planogram_path):
    quads = planogram_quads(planogram_path)
    cr = json.load(open(os.path.join(HERE, "cache", "crates.json")))
    crate_quads = {c["id"]: np.array(c["quad"], np.float32) for cam in cr["cameras"].values() for c in cam}
    a2c = cr["area_to_crate"]
    shared = {a: float(sum(1 for v in a2c.values() if v == c) > 1) for a, c in a2c.items()}
    return dict(quads=quads, crate_quads=crate_quads, a2c=a2c, shared=shared)


def cam_areas(quads, cam):
    return [a for a in quads if a.split("_")[0] == cam]


# ---------------------------------------------------------------- stock model
def _lr(C):
    from sklearn.linear_model import LogisticRegression
    from sklearn.pipeline import make_pipeline
    from sklearn.preprocessing import StandardScaler
    return make_pipeline(StandardScaler(), LogisticRegression(C=C, max_iter=3000))


def _proba(clf, X):
    P = np.zeros((len(X), 3))
    cls = clf[-1].classes_ if hasattr(clf, "steps") else clf.classes_
    P[:, cls] = clf.predict_proba(X)
    return P


def _points(P, y):
    return sum(E.POINTS[E.LEVELS.index(E.decide(p)), t] for p, t in zip(P, y))


def fit_stock(X, y, cams):
    best = None
    for C in CS:
        s = 0.0
        for c in np.unique(cams):
            m = cams == c
            s += _points(_proba(_lr(C).fit(X[~m], y[~m]), X[m]), y[m])
        if best is None or s > best[0]:
            best = (s, C)
    lin = _lr(best[1]).fit(X, y)
    from sklearn.ensemble import HistGradientBoostingClassifier
    hgb = HistGradientBoostingClassifier(max_depth=3, learning_rate=0.05, max_iter=200, l2_regularization=1.0,
                                         min_samples_leaf=20, random_state=0).fit(X, y)
    return dict(lin=lin, hgb=hgb, C=best[1])


def stock_proba(m, X):
    P2 = np.zeros((len(X), 3))
    P2[:, m["hgb"].classes_] = m["hgb"].predict_proba(X)
    return 0.5 * _proba(m["lin"], X) + 0.5 * P2


# ---------------------------------------------------------------- compliance bank
def _dist(q, B):
    return np.nan if B is None or len(B) == 0 else float(1 - (B @ q).max())


def comp_feats(H, aids, bank):
    X = []
    for q, a in zip(H, aids):
        comp, nc = bank.get(a, (None, None))
        dc, dn = _dist(q, comp), _dist(q, nc)
        dc = 1.0 if np.isnan(dc) else dc
        X.append([dc, 0.0 if np.isnan(dn) else dc - dn, float(not np.isnan(dn))])
    return np.array(X)


def make_bank(H, aids, nc_flags):
    comp, nc = {}, {}
    for h, a, n in zip(H, aids, nc_flags):
        (nc if n else comp).setdefault(a, []).append(h)
    return {a: (np.array(comp[a]) if a in comp else None, np.array(nc[a]) if a in nc else None)
            for a in set(comp) | set(nc)}


def fit_compliance(H, aids, nc_flags, folds):
    from sklearn.linear_model import LogisticRegression
    aids, nc_flags, folds = np.asarray(aids), np.asarray(nc_flags), np.asarray(folds)
    X, y = [], []
    for f in sorted(set(folds)):
        inn, out = folds == f, folds != f
        bank = make_bank(H[out], aids[out], nc_flags[out])
        X.append(comp_feats(H[inn], aids[inn], bank)); y += list(nc_flags[inn].astype(int))
    lr = LogisticRegression(C=1.0, max_iter=2000).fit(np.concatenate(X), np.array(y))
    return dict(lr=lr, bank=make_bank(H, aids, nc_flags))


def compliant(m, H, aids):
    return ~(m["lr"].predict_proba(comp_feats(H, aids, m["bank"]))[:, 1] > 0.5)
