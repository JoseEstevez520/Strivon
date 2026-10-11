"""Faster, decision-identical `predict` for the Strivon image-only ensemble (same CLI and same model file as predict.py).

  python lab/predict_fast.py predict --images DIR --model lab/models/lane_i_ens.pkl --out preds.json [--threads 1]
                                     [--timing t.json] [--features f.pkl]
  python lab/predict_fast.py train ...      (forwarded to predict.py, which owns training)

What is different from predict.py (the arithmetic of every decision is the same; see PREDICT.md for the cost table):
  * No torch, timm or scikit-learn at inference. The model pickle is read with a stub unpickler that keeps the fitted
    parameters of the sklearn objects as plain numpy arrays; logistic regressions and the 200x3 histogram-gradient-boosting
    trees are evaluated in numpy; the fine-tuned MobileNetV3-small is run by a small numpy forward (BatchNorm folded into the
    convolutions, NHWC float32), and the crate crop is pushed through the net once per crate instead of once per area.
  * Pixel features: one HSV/gray conversion per crop shared by the x01 block and the h01 block, colour masks with
    cv2.inRange, counts with countNonZero, percentiles of the 8-bit S and V channels from a 256-bin histogram (same
    linear-interpolation rule as numpy), slopes in closed form. Booleans, counts and warps are bit-identical to predict.py.
  * The "other families" bank of the planogram-family check is concatenated once per (camera, family) and cached.
"""
import os
import re
import sys
import time

T_START = time.perf_counter()


def _threads(argv):
    n = "2"
    if "--threads" in argv:
        n = argv[argv.index("--threads") + 1]
    for k in ("OMP_NUM_THREADS", "OPENBLAS_NUM_THREADS", "MKL_NUM_THREADS", "NUMEXPR_NUM_THREADS"):
        os.environ[k] = n
    return int(n)


if len(sys.argv) > 1 and sys.argv[1] == "train":
    here = os.path.dirname(os.path.abspath(__file__))
    os.execv(sys.executable, [sys.executable, os.path.join(here, "predict.py")] + sys.argv[1:])

NTHREADS = _threads(sys.argv)

import argparse  # noqa: E402
import json  # noqa: E402
import pickle  # noqa: E402
import re  # noqa: E402

import cv2  # noqa: E402

cv2.setNumThreads(1)
import numpy as np  # noqa: E402
from numpy.lib.stride_tricks import sliding_window_view  # noqa: E402

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
T_IMPORTS = time.perf_counter()

LEVELS = ["empty", "half", "full"]
VAL = {"empty": 0.0, "half": 0.5, "full": 1.0}
POINTS = np.array([[1, -2, -2], [-3, 1, -2], [-3, -3, 1]], dtype=float)
SIZE = (96, 96)
S48, S112 = 48, 112
NB, BS, NF = 8, 12, 68
E01_MEMBERS = ["h01d", "r01b", "cnn"]


FULL_WEIGHT = 1.0  # --full-weight: p(full) is multiplied by this before the expected-points decision (1.0 = unchanged)


def decide(probs):
    if FULL_WEIGHT != 1.0:
        probs = probs * np.array([1.0, 1.0, FULL_WEIGHT])
    return LEVELS[int(np.argmax(POINTS @ probs))]


def die(msg):
    print(f"predict.py: ERROR: {msg}", file=sys.stderr)
    sys.exit(2)


# ---------------------------------------------------------------- model file without sklearn
class _Stub:
    def __init__(self, *a, **k):
        pass

    def __setstate__(self, s):
        self.state = s


class _Unpickler(pickle.Unpickler):
    def find_class(self, module, name):
        if module.startswith("sklearn"):
            return type(name, (_Stub,), {})
        return super().find_class(module, name)


class Timer:
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


def softmax_rows(X):
    X = X - np.max(X, axis=1).reshape((-1, 1))
    np.exp(X, X)
    X /= np.sum(X, axis=1).reshape((-1, 1))
    return X


class LinHead:
    """StandardScaler + multinomial LogisticRegression (predict_proba) from the stored arrays."""

    def __init__(self, pipe):
        sc, lr = (s.state for _, s in pipe.state["steps"])
        self.mean, self.scale = sc["mean_"], sc["scale_"]
        self.coef, self.icpt = lr["coef_"], lr["intercept_"]
        self.classes = lr["classes_"]

    def proba(self, X):
        X = np.array(X, dtype=np.float64)
        X -= self.mean
        X /= self.scale
        d = X @ self.coef.T + self.icpt
        P = np.zeros((len(X), 3))
        P[:, self.classes] = softmax_rows(d)
        return P


class Trees:
    """HistGradientBoostingClassifier.predict_proba on raw features (no missing values), vectorised over trees."""

    def __init__(self, hgb):
        s = hgb.state
        preds = s["_predictors"]
        k = s["n_trees_per_iteration_"]
        self.k, self.n_it = k, len(preds)
        self.classes = s["classes_"]
        self.base = np.asarray(s["_baseline_prediction"], np.float64).reshape(1, -1)
        trees = [p.state["nodes"] for it in preds for p in it]
        T = len(trees)
        W = max(len(n) for n in trees)
        feat = np.zeros((T, W), np.int64)
        thr = np.full((T, W), np.inf)
        left = np.tile(np.arange(W), (T, 1))
        right = left.copy()
        val = np.zeros((T, W))
        depth = 0
        for t, n in enumerate(trees):
            m = len(n)
            leaf = n["is_leaf"].astype(bool)
            feat[t, :m] = np.where(leaf, 0, n["feature_idx"])
            thr[t, :m] = np.where(leaf, np.inf, n["num_threshold"])
            left[t, :m] = np.where(leaf, np.arange(m), n["left"])
            right[t, :m] = np.where(leaf, np.arange(m), n["right"])
            val[t, :m] = n["value"]
            depth = max(depth, int(n["depth"].max()))
        self.feat, self.thr, self.left, self.right, self.val = feat, thr, left, right, val
        self.depth, self.T = depth, T
        self.tix = np.arange(T)

    def proba(self, X):
        R = len(X)
        idx = np.zeros((R, self.T), np.int64)
        rows = np.arange(R)[:, None]
        for _ in range(self.depth):
            f = self.feat[self.tix, idx]
            go = X[rows, f] <= self.thr[self.tix, idx]
            idx = np.where(go, self.left[self.tix, idx], self.right[self.tix, idx])
        v = self.val[self.tix, idx].reshape(R, self.n_it, self.k)
        raw = np.cumsum(np.concatenate([np.broadcast_to(self.base, (R, 1, self.k)), v], axis=1), axis=1)[:, -1]
        P = np.zeros((R, 3))
        P[:, self.classes] = softmax_rows(raw)
        return P


# ---------------------------------------------------------------- geometry and crops
def planogram_quads(path):
    p = json.load(open(path))["Frutas e Legumes"]["cameras"]
    out = {}
    for c in p.values():
        for a in c["products"]:
            k = a["image_coordinates"]
            out[a["area_id"]] = np.array([k[n] for n in ("top_left", "top_right", "bottom_right", "bottom_left")], np.float32)
    return out


def cam_areas(quads, cam):
    return [a for a in quads if a.split("_")[0] == cam]


def _warp(im, q, size):
    dst = np.array([[0, 0], [size[0], 0], [size[0], size[1]], [0, size[1]]], np.float32)
    return cv2.warpPerspective(im, cv2.getPerspectiveTransform(q, dst), size, borderMode=cv2.BORDER_REFLECT)


def area_crop(im, q, size, expand=1.0):
    if expand != 1.0:
        c = q.mean(0)
        q = c + (q - c) * expand
    return _warp(im, q, size)


# ---------------------------------------------------------------- fused pixel features (x01 28 + h01 68 per 96 px crop)
_K5 = np.ones((5, 5), np.uint8)
_LUT35 = np.where(np.arange(256) / 255.0 > 0.35, 255, 0).astype(np.uint8)
_LUT50 = np.where(np.arange(256) / 255.0 > 0.5, 255, 0).astype(np.uint8)
_V255 = np.arange(256) / 255.0
_NPIX = SIZE[0] * SIZE[1]
_HALF = _NPIX // 2
_VAND = np.vander(np.arange(NB, dtype=np.float64), 2)
_VSCALE = np.sqrt((_VAND * _VAND).sum(axis=0))
_VAND /= _VSCALE
_RCOND = NB * np.finfo(np.float64).eps


def _hist_pct(plane, qs):
    """np.percentile(plane / 255.0, qs) for an 8-bit plane (linear interpolation), from a 256-bin histogram."""
    cum = np.cumsum(np.bincount(plane.ravel(), minlength=256))
    n = plane.size
    out = []
    for q in qs:
        virt = (n - 1) * (q / 100.0)
        lo = int(np.floor(virt))
        g = virt - lo
        hi = min(lo + 1, n - 1)
        a = _V255[np.searchsorted(cum, lo, "right")]
        b = _V255[np.searchsorted(cum, hi, "right")]
        d = b - a
        r = a + d * g
        if g >= 0.5:
            r = b - d * (1 - g)
        out.append(r)
    return out


def _slope(p):
    """np.polyfit(arange(8), p, 1)[0], same LAPACK call (a closed form would differ in the last bit and the trees split on it)."""
    c = np.linalg.lstsq(_VAND, p, rcond=_RCOND)[0]
    return float((c.T / _VSCALE).T[0])


def _occupancy(p):
    cov = p > 0.5
    anyc = bool(cov.any())
    lead = int(np.argmax(cov)) if anyc else NB
    trail = int(np.argmax(cov[::-1])) if anyc else NB
    return [cov.mean(), p.min(), p.max(), lead / NB, trail / NB, _slope(p)]


def _bands(m):
    b = m > 0
    r = b.sum(1).reshape(NB, BS).sum(1) / (BS * SIZE[0])
    c = b.sum(0).reshape(NB, BS).sum(1) / (BS * SIZE[1])
    return r.astype(np.float32), c.astype(np.float32)


def _largest(m):
    """Area of the largest 8-connected blob of a 0/255 mask over the mask size (0 when empty)."""
    if not cv2.countNonZero(m):
        return 0.0
    n, _, st, _ = cv2.connectedComponentsWithStats(m, 8)
    return st[1:, cv2.CC_STAT_AREA].max() / m.size if n > 1 else 0.0


def _pct_f32(a, qs):
    """np.percentile(a, qs) for a float32 vector (linear method, float64 result)."""
    a = np.sort(a.ravel())
    n = a.size
    out = []
    for q in qs:
        virt = (n - 1) * (q / 100.0)
        lo = int(np.floor(virt))
        g = virt - lo
        A, B = a[lo], a[min(lo + 1, n - 1)]
        d = float(B - A)
        r = float(A) + d * g
        if g >= 0.5:
            r = float(B) - d * (1 - g)
        out.append(r)
    return out


def crop_both(c):
    """Return (x01 features [28], h01 features [68]) of one 96x96 BGR crop; equals predict_lib.crop_feats and
    predict_lib_ens.h01_crop_feats."""
    hsv = cv2.cvtColor(c, cv2.COLOR_BGR2HSV)
    g = cv2.cvtColor(c, cv2.COLOR_BGR2GRAY)
    ir = cv2.inRange
    teal = ir(hsv, (70, 60, 40), (105, 255, 255))
    dark = ir(hsv, (0, 0, 0), (255, 255, 54))
    grey = ir(hsv, (0, 0, 55), (255, 39, 214))
    brown = ir(hsv, (5, 35, 70), (22, 129, 219))
    white = ir(hsv, (0, 0, 215), (255, 39, 255))
    bg = cv2.bitwise_or(cv2.bitwise_or(teal, dark), grey)
    bg4 = cv2.bitwise_or(bg, white)
    ch, cs, cv_ = cv2.split(hsv)
    sgt = cv2.LUT(cs, _LUT35)
    nz = cv2.countNonZero
    f = []
    for m in (teal, dark, grey, brown, bg):
        f += [nz(m) / _NPIX, nz(m[:48]) / _HALF, nz(m[48:]) / _HALF]
    bo = cv2.morphologyEx(bg, cv2.MORPH_OPEN, _K5)
    f.append(_largest(bo))
    f.append(_largest(cv2.morphologyEx(teal, cv2.MORPH_OPEN, _K5)))
    e = cv2.Canny(g, 60, 150)
    f += [nz(e) / _NPIX, nz(e[:48]) / _HALF, nz(e[48:]) / _HALF]
    lap = cv2.Laplacian(g, cv2.CV_32F)
    f.append(float(np.log1p(lap.var())))
    s = cs / 255.0
    v = cv_ / 255.0
    prod = cv2.bitwise_and(cv2.bitwise_not(bg), sgt)
    f += [s.mean(), s.std(), v.mean(), v.std(), nz(prod) / _NPIX, nz(prod[:48]) / _HALF, nz(prod[48:]) / _HALF]
    x = [float(t) for t in f]

    prod4 = cv2.bitwise_and(cv2.bitwise_not(bg4), sgt)
    h = []
    rp, cp = _bands(prod4)
    bp, _ = _bands(bg4)
    h += list(rp) + list(cp) + list(bp)
    h += _occupancy(rp) + _occupancy(cp)[:3]
    g2 = cv2.resize(g, (SIZE[0] // 2, SIZE[1] // 2), interpolation=cv2.INTER_AREA)
    tex = []
    for gg, lp in ((g, lap), (g2, None)):
        if lp is None:
            lp = cv2.Laplacian(gg, cv2.CV_32F)
        sx, sy = cv2.Sobel(gg, cv2.CV_32F, 1, 0), cv2.Sobel(gg, cv2.CV_32F, 0, 1)
        tex += [np.log1p(np.abs(lp).mean()), np.log1p(np.sqrt(sx * sx + sy * sy).mean())]
    h += tex + [tex[0] - tex[2], tex[1] - tex[3]]
    blk = g.reshape(SIZE[1] // BS, BS, SIZE[0] // BS, BS).astype(np.float32).std((1, 3))
    h += [blk.mean(), *_pct_f32(blk, (25, 75)), (blk < 8).mean(), (blk < 15).mean()]
    h += list(blk.mean(1))
    h += _hist_pct(cs, [10, 25, 50, 75, 90]) + [nz(sgt) / _NPIX, nz(cv2.LUT(cs, _LUT50)) / _NPIX]
    h += _hist_pct(cv_, [10, 50, 90])
    hh = ch[prod4 > 0]
    if hh.size:
        hist = np.bincount(hh, minlength=180)[:180].reshape(6, 30).sum(1).astype(np.float32)
    else:
        hist = np.zeros(6, np.float32)
    h += list(hist / max(1.0, hist.sum()))
    return x, [float(t) for t in h]


def r01_prep(c):
    g = cv2.cvtColor(c, cv2.COLOR_BGR2GRAY).astype(np.float32)
    g = (g - g.mean()) / (g.std() + 1e-3)
    hs = cv2.cvtColor(c, cv2.COLOR_BGR2HSV)
    h = cv2.calcHist([hs], [0, 1], None, [8, 4], [0, 180, 0, 256]).ravel()
    h /= h.sum()
    return g, h


def feats_vs(g, h, rg, rh):
    d = np.abs(g - rg)
    cells = d.reshape(4, S48 // 4, 4, S48 // 4).mean((1, 3)).ravel()
    bc = -np.log(np.sqrt(h * rh).sum() + 1e-6)
    cc = (g * rg).mean()
    return np.concatenate([cells, [d.mean(), bc, cc]])


def wb_norm(c):
    f = c.astype(np.float32)
    m = f.reshape(-1, 3).mean(0) + 1e-3
    f *= np.clip(m.mean() / m, 0.67, 1.5)
    return np.clip(f, 0, 255).astype(np.uint8)


def hsv_of(c48):
    hsv = cv2.cvtColor(c48, cv2.COLOR_BGR2HSV)
    h = cv2.calcHist([hsv], [0, 1], None, [12, 4], [0, 180, 0, 256]).ravel()
    h /= h.sum() + 1e-9
    return np.sqrt(h)


# ---------------------------------------------------------------- MobileNetV3-small in numpy (NHWC, BN folded)
MEAN = np.array([0.485, 0.456, 0.406], np.float32)
STD = np.array([0.229, 0.224, 0.225], np.float32)
_NORM = [((np.arange(256).astype(np.float32) / 255.0) - MEAN[c]) / STD[c] for c in range(3)]  # per RGB channel
DST112 = np.array([[0, 0], [S112, 0], [S112, S112], [0, S112]], np.float32)
# (block, index) -> (kind, stride, activation, has_se, skip)   from timm mobilenetv3_small_100
_SPEC = [("ds", 2, "relu", True, False)] + [
    ("ir", 2, "relu", False, False), ("ir", 1, "relu", False, True),
    ("ir", 2, "hs", True, False), ("ir", 1, "hs", True, True), ("ir", 1, "hs", True, True),
    ("ir", 1, "hs", True, False), ("ir", 1, "hs", True, True),
    ("ir", 2, "hs", True, False), ("ir", 1, "hs", True, True), ("ir", 1, "hs", True, True), ("cba", 1, "hs", False, False)]
_BLOCK_IDS = [(0, 0), (1, 0), (1, 1), (2, 0), (2, 1), (2, 2), (3, 0), (3, 1), (4, 0), (4, 1), (4, 2), (5, 0)]


def _act(x, kind):
    if kind == "relu":
        return np.maximum(x, 0, out=x)
    if kind == "hs":  # x * relu6(x + 3) / 6
        t = x + np.float32(3)
        np.clip(t, 0, 6, out=t)
        t *= x
        t *= np.float32(1 / 6)
        return t
    return x


class NumpyNet:
    def __init__(self, sd):
        f32 = np.float32

        def fold(prefix, conv_w):
            g, b = sd[prefix + ".weight"], sd[prefix + ".bias"]
            mu, var = sd[prefix + ".running_mean"], sd[prefix + ".running_var"]
            sc = g / np.sqrt(var + 1e-5)
            return conv_w * sc.reshape(-1, 1, 1, 1), (b - mu * sc)

        def pw(w):  # (Co, Ci, 1, 1) -> (Ci, Co)
            return np.ascontiguousarray(w[:, :, 0, 0].T, f32)

        def dw(w):  # (C, 1, k, k) -> (k, k, C)
            return np.ascontiguousarray(w[:, 0].transpose(1, 2, 0), f32)

        w, b = fold("b.bn1", sd["b.conv_stem.weight"])
        self.stem = (np.ascontiguousarray(w.transpose(2, 3, 1, 0).reshape(27, -1), f32), b.astype(f32))
        self.blocks = []
        for (bi, ji), (kind, stride, act, se, skip) in zip(_BLOCK_IDS, _SPEC[:]):
            p = f"b.blocks.{bi}.{ji}."
            d = dict(kind=kind, stride=stride, act=act, skip=skip)
            if kind == "ds":
                w, bb = fold(p + "bn1", sd[p + "conv_dw.weight"]); d["dw"] = (dw(w), bb.astype(f32))
                w, bb = fold(p + "bn2", sd[p + "conv_pw.weight"]); d["pw"] = (pw(w), bb.astype(f32))
            elif kind == "ir":
                w, bb = fold(p + "bn1", sd[p + "conv_pw.weight"]); d["pw"] = (pw(w), bb.astype(f32))
                w, bb = fold(p + "bn2", sd[p + "conv_dw.weight"]); d["dw"] = (dw(w), bb.astype(f32))
                w, bb = fold(p + "bn3", sd[p + "conv_pwl.weight"]); d["pwl"] = (pw(w), bb.astype(f32))
            else:
                w, bb = fold(p + "bn1", sd[p + "conv.weight"]); d["pw"] = (pw(w), bb.astype(f32))
            if se:
                d["se"] = (pw(sd[p + "se.conv_reduce.weight"]), sd[p + "se.conv_reduce.bias"].astype(f32),
                           pw(sd[p + "se.conv_expand.weight"]), sd[p + "se.conv_expand.bias"].astype(f32))
            self.blocks.append(d)
        self.head = (pw(sd["b.conv_head.weight"]), sd["b.conv_head.bias"].astype(f32))
        self.fc_w, self.fc_b = sd["head.weight"].astype(f32), sd["head.bias"].astype(f32)

    @staticmethod
    def _dw(x, wb, stride):
        w, b = wb
        k = w.shape[0]
        p = k // 2
        N, H, W, C = x.shape
        Ho, Wo = (H + 2 * p - k) // stride + 1, (W + 2 * p - k) // stride + 1
        xp = np.zeros((N, H + 2 * p, W + 2 * p, C), np.float32)
        xp[:, p:p + H, p:p + W] = x
        win = sliding_window_view(xp, (k, k), axis=(1, 2))[:, ::stride, ::stride]
        out = np.einsum("nhwckl,klc->nhwc", win[:, :Ho, :Wo], w)
        out += b
        return out

    @staticmethod
    def _pw(x, wb):
        w, b = wb
        N, H, W, C = x.shape
        y = x.reshape(-1, C) @ w
        y += b
        return y.reshape(N, H, W, -1)

    def trunk(self, bgr):
        """bgr: (N, 112, 112, 3) uint8 BGR crops -> (N, 1024) pooled features (RGB, mean/std normalised, as torch)."""
        N, H, W, _ = bgr.shape
        xp = np.zeros((N, H + 2, W + 2, 3), np.float32)
        for c in range(3):
            xp[:, 1:H + 1, 1:W + 1, c] = _NORM[c][bgr[..., 2 - c]]
        Ho, Wo = H // 2, W // 2
        win = sliding_window_view(xp, (3, 3), axis=(1, 2))[:, ::2, ::2][:, :Ho, :Wo]
        cols = np.ascontiguousarray(win.transpose(0, 1, 2, 4, 5, 3))
        x = (cols.reshape(-1, 27) @ self.stem[0] + self.stem[1]).reshape(N, Ho, Wo, -1)
        x = _act(x, "hs")
        for d in self.blocks:
            inp = x
            if d["kind"] == "ds":
                x = _act(self._dw(x, d["dw"], d["stride"]), d["act"])
            elif d["kind"] == "ir":
                x = _act(self._pw(x, d["pw"]), d["act"])
                x = _act(self._dw(x, d["dw"], d["stride"]), d["act"])
            else:
                x = _act(self._pw(x, d["pw"]), d["act"])
            if "se" in d:
                wr, br, we, be = d["se"]
                s = x.mean((1, 2))
                s = np.maximum(s @ wr + br, 0)
                s = s @ we + be
                s = np.clip(s + 3, 0, 6) / 6
                x *= s[:, None, None, :]
            if d["kind"] == "ds":
                x = self._pw(x, d["pw"])
            elif d["kind"] == "ir":
                x = self._pw(x, d["pwl"])
            if d["skip"]:
                x = x + inp
        x = x.mean((1, 2))
        x = x @ self.head[0] + self.head[1]
        return _act(x, "hs")

    def logits(self, crate, crate_ix, poly, sh):
        """crate: (U, 112, 112, 3) uint8 BGR crop per distinct crate; crate_ix: crate row of each area; poly: (A, ...) likewise."""
        fc = self.trunk(crate)[crate_ix]
        fp = self.trunk(poly)
        z = np.concatenate([fc, fp, sh[:, None]], 1)
        return z @ self.fc_w.T + self.fc_b


# ---------------------------------------------------------------- the model
class Fast:
    def __init__(self, model):
        e = model["ens"]
        self.e, self.geo = e, model["geo"]
        self.weights = e["weights"]
        self.wb = e.get("comp_wb", False)
        self.h_lin, self.h_trees = LinHead(e["h01d"]["lin"]), Trees(e["h01d"]["hgb"])
        self.r_lin, self.r_trees = LinHead(e["r01b"]["lin"]), Trees(e["r01b"]["hgb"])
        self.net = NumpyNet(e["cnn"])
        self.p01_lr = e["comp_p01"]["lr"].state
        self.p01_bank = e["comp_p01"]["bank"]
        self.v01 = e["comp_v01"]
        self.enf, self.famof, self.fam1h = e["enf"], e["famof"], e["fam1h"]
        self._oth = {}
        # per-slot prototypes of the h01d "SlotRel" block
        R = e["h01d"]["rel"]
        self.rel_mu, self.rel_sd = R["mu"], R["sd"]
        self.proto = {}
        for a in self.geo["quads"]:
            def look(lvl):
                s, f, g = R["proto"][lvl]
                return s.get(a, f.get(self.famof[a], g))
            self.proto[a] = (look(2), look(1))

    # -- h01d / r01b
    def h01d_design(self, Xb, Xh, aids):
        Z = (Xh[:, :NF] - self.rel_mu) / self.rel_sd
        out = []
        for a, z in zip(aids, Z):
            pf, ph = self.proto[a]
            d = z - pf
            out.append(np.concatenate([d, [np.linalg.norm(d), np.linalg.norm(z - ph), np.linalg.norm(d) - np.linalg.norm(z - ph)]]))
        return np.concatenate([Xb, Xh, np.array([self.fam1h[a] for a in aids]), np.array(out)], 1)

    def r01_rows(self, G, Hr, aids):
        out = []
        refs = self.e["r01b"]["refs"]
        for g, h, a in zip(G, Hr, aids):
            fs = [np.zeros(19) if rf is None else feats_vs(g, h, *rf) for rf in refs[a]]
            fs.append(fs[0] - fs[1])
            out.append(np.concatenate(fs))
        return np.array(out)

    @staticmethod
    def blend(lin, trees, X):
        return 0.5 * lin.proba(X) + 0.5 * trees.proba(X)

    # -- compliance
    @staticmethod
    def _d32(F, v):
        return float(1 - (F @ v).max())

    def p01_ok(self, Hq, aids):
        X = []
        for q, a in zip(Hq, aids):
            comp, nc = self.p01_bank.get(a, (None, None))
            dc = np.nan if comp is None or len(comp) == 0 else self._d32(comp, q)
            dn = np.nan if nc is None or len(nc) == 0 else self._d32(nc, q)
            dc = 1.0 if np.isnan(dc) else dc
            X.append([dc, 0.0 if np.isnan(dn) else dc - dn, float(not np.isnan(dn))])
        s = self.p01_lr
        z = np.array(X) @ s["coef_"].T + s["intercept_"]
        z = z.ravel()
        p1 = softmax_rows(np.c_[-z, z])[:, 1]  # binary case of LogisticRegression.predict_proba
        return ~(p1 > 0.5)

    def v01_nc(self, Hq, cam, aids):
        bk = self.v01["bank"]
        F = np.asarray(Hq, np.float32)
        Fn = F / (np.linalg.norm(F, axis=1, keepdims=True) + 1e-9)
        s = []
        for f, a in zip(Fn, aids):
            fm = self.enf[a]

            def d(v, B):
                return float(1 - (B @ v).max()) if B is not None and len(B) else np.nan
            d_own = d(f, bk["fam_all"].get(fm))
            key = (cam, fm)
            if key not in self._oth:
                oth = [v for (cc, g), v in bk["own"].items() if cc == cam and g != fm]
                self._oth[key] = np.concatenate(oth) if oth else None
            d_oth = d(f, self._oth[key])
            d_emp = d(f, bk["emp"].get(cam))
            margin = d_own - d_oth
            notempty = not (d_emp < d_oth)
            s.append(-np.inf if (np.isnan(margin) or not notempty) else margin)
        return np.array(s) >= self.v01["t"]

    # -- one photo
    def predict_photo(self, im, cam, aids, t):
        q, a2c, geo = self.geo["quads"], self.geo["a2c"], self.geo
        with t("x01"):
            cids = sorted({a2c[a] for a in aids})
            crate96 = {c: _warp(im, geo["crate_quads"][c], SIZE) for c in cids}
            p10 = {a: area_crop(im, q[a], SIZE, 1.0) for a in aids}
            p16 = {a: area_crop(im, q[a], SIZE, 1.6) for a in aids}
            cf = {c: crop_both(v) for c, v in crate96.items()}
            pf10 = {a: crop_both(p10[a]) for a in aids}
            pf16 = {a: crop_both(p16[a]) for a in aids}
            Xb = np.array([pf10[a][0] + pf16[a][0] + cf[a2c[a]][0] + [geo["shared"][a]] for a in aids], float)
            Xh = np.array([cf[a2c[a]][1] + pf10[a][1] + pf16[a][1] for a in aids], float)
        with t("r01"):
            c48 = [area_crop(im, q[a], (S48, S48)) for a in aids]
            gh = [r01_prep(c) for c in c48]
            G = np.array([g for g, _ in gh])
            Hr = np.array([h for _, h in gh])
        with t("comp"):
            c48h = [wb_norm(c) for c in c48] if self.wb else c48
            Hsv = np.array([hsv_of(c) for c in c48h], np.float32)
        with t("cnn"):
            crate_u8 = np.empty((len(cids), S112, S112, 3), np.uint8)
            for k, cid in enumerate(cids):
                M = cv2.getPerspectiveTransform(geo["crate_quads"][cid], DST112)
                crate_u8[k] = cv2.warpPerspective(im, M, (S112, S112), borderMode=cv2.BORDER_REFLECT)
            poly_u8 = np.empty((len(aids), S112, S112, 3), np.uint8)
            for i, a in enumerate(aids):
                poly_u8[i] = area_crop(im, q[a], (S112, S112), 1.1)
            sh = np.array([geo["shared"][a] for a in aids], np.float32)
            cix = [cids.index(a2c[a]) for a in aids]
            Pc = softmax_rows(self.net.logits(crate_u8, cix, poly_u8, sh).astype(np.float32)).astype(float)
        finite = all(np.isfinite(x).all() for x in (Xb, Xh, G, Hr, Hsv))
        with t("heads"):
            Ph = self.blend(self.h_lin, self.h_trees, self.h01d_design(Xb, Xh, aids))
            Pr = self.blend(self.r_lin, self.r_trees, np.hstack([Xb, self.r01_rows(G, Hr, aids)]))
            Pm = dict(h01d=Ph, r01b=Pr, cnn=Pc)
            Pe = sum(wi * Pm[n] for wi, n in zip(self.weights, E01_MEMBERS))
            lv = [decide(p) for p in Pe]
        with t("comp"):
            ok = self.p01_ok(Hsv, aids) & ~self.v01_nc(Hsv, cam, aids)
        return lv, ok, Pe, Pm, finite


def predict(a):
    global FULL_WEIGHT
    FULL_WEIGHT = float(a.full_weight)
    model = _Unpickler(open(a.model, "rb")).load()
    geo = model["geo"]
    if not model["version"].startswith("lane_i_ens"):
        os.execv(sys.executable, [sys.executable, os.path.join(HERE, "predict.py")] + sys.argv[1:])  # older x01 model
    rt = Fast(model)
    pq = planogram_quads(a.planogram)
    T_LOAD = time.perf_counter()
    if not os.path.isdir(a.images):
        die(f"no such folder {a.images}")
    def warn(m):
        print(f"predict.py: WARNING: {m}", file=sys.stderr)

    def resolve_cam(parts):
        """Camera of a folder: the innermost folder name that is a planogram camera, else the only 4-digit id inside a name."""
        for name in reversed(parts):
            if cam_areas(pq, name):
                return name
        for name in reversed(parts):
            ids = {m for m in re.findall(r"\d{4}", name) if cam_areas(pq, m)}
            if len(ids) == 1:
                return ids.pop()
        return None

    jobs, seen, geo_ok, skipped = [], set(), set(), []
    for dirpath, dirnames, files in os.walk(a.images):
        dirnames[:] = sorted(x for x in dirnames if not x.startswith(".") and x != "__MACOSX")
        rel = os.path.relpath(dirpath, a.images)
        parts = [] if rel == "." else rel.split(os.sep)
        files = sorted(f for f in files if not f.startswith("."))  # .DS_Store, macOS ._x.jpg
        imgs = [f for f in files if f.lower().endswith((".jpg", ".jpeg", ".png"))]
        other = [f for f in files if f.lower().endswith((".bmp", ".tif", ".tiff", ".webp"))]
        for f in other:
            skipped.append(f"{rel}/{f}: image format not read, only .jpg .jpeg .png")
        if not imgs:
            continue
        cam = resolve_cam(parts)
        if cam is None:
            for f in imgs:
                skipped.append(f"{rel}/{f}: cannot tell the camera from the folder name (use <camera id>/<photo>.jpg)")
            continue
        if parts and parts[-1] != cam:
            warn(f"folder {rel} read as camera {cam}")
        aids = cam_areas(pq, cam)
        if cam not in geo_ok:
            for aid in aids:
                if aid not in geo["quads"] or aid not in geo["a2c"] or not np.allclose(geo["quads"][aid], pq[aid]):
                    die(f"area {aid} of the planogram is not in the model geometry (or its quad changed); retrain")
            geo_ok.add(cam)
        for f in imgs:
            if (cam, f) in seen:
                skipped.append(f"{rel}/{f}: a photo with this name is already read for camera {cam}")
                continue
            seen.add((cam, f))
            jobs.append((cam, f, aids, os.path.join(dirpath, f)))
    for m in skipped:
        warn(f"skipped {m}")
    if not jobs:
        die(f"no photos under {a.images}/<camera>/ (.jpg, .jpeg or .png)")
    out, timing, feats, fallbacks = {}, [], {}, []
    for cam, img, aids, path in jobs:
        t = Timer()
        with t("decode"):
            im = cv2.imread(path)
        if im is None:
            warn(f"cannot read image {cam}/{img}: answering compliant and full for its {len(aids)} areas")
            fallbacks.append(f"{cam}/{img}: unreadable image, fallback answers")
            out.setdefault(cam, {})[img] = {aid: dict(planogram_compliant=True, stock_level="full", stock_value=VAL["full"]) for aid in aids}
            if a.p_stock:
                for aid in aids:
                    out[cam][img][aid]["p_stock"] = [0.0, 0.0, 1.0]
            continue
        if im.shape != tuple(model["image_shape"]):
            warn(f"{cam}/{img} is {im.shape}, the planogram coordinates are for {tuple(model['image_shape'])}: resized")
            h, w = model["image_shape"][:2]
            im = cv2.resize(im, (w, h), interpolation=cv2.INTER_AREA)
        lv, ok, Pr, Pm, fin = rt.predict_photo(im, cam, aids, t)
        if not fin:
            die(f"NaN in the features of {cam}/{img}")
        if not np.isfinite(Pr).all():
            die(f"NaN stock probability in {cam}/{img}")
        out.setdefault(cam, {})[img] = {aid: dict(planogram_compliant=bool(c), stock_level=l, stock_value=VAL[l])
                                        for aid, l, c in zip(aids, lv, ok)}
        if a.p_stock:  # optional: the ensemble's [p_empty, p_half, p_full] per area, so the team can average models
            for i, aid in enumerate(aids):
                out[cam][img][aid]["p_stock"] = [round(float(x), 5) for x in Pr[i]]
        timing.append(dict(photo=f"{cam}/{img}", areas=len(aids), wall=t.wall, cpu=t.cpu))
        if a.features:
            feats[f"{cam}/{img}"] = (aids, Pm, None, Pr)
    for cam, imgs in out.items():
        need = set(cam_areas(pq, cam))
        for img, areas in imgs.items():
            if set(areas) != need:
                die(f"{cam}/{img}: missing areas {sorted(need - set(areas))}")
    json.dump(out, open(a.out, "w"), indent=1)
    n_img = sum(len(v) for v in out.values()); n_area = sum(len(x) for v in out.values() for x in v.values())
    bad = list(skipped) + list(fallbacks)
    if a.expect_images is not None and n_img != a.expect_images:
        bad.append(f"found {n_img} photos, expected {a.expect_images}")
    if a.expect_areas is not None and n_area != a.expect_areas:
        bad.append(f"{n_area} areas predicted, expected {a.expect_areas}")
    for m in bad:
        print(f"predict.py: WARNING: {m}: check the folder and the planogram (a missing area costs -5)", file=sys.stderr)
    T_END = time.perf_counter()
    if a.timing:
        json.dump(dict(imports=T_IMPORTS - T_START, load=T_LOAD - T_IMPORTS, total=T_END - T_START,
                       cpu_total=time.process_time(), threads=NTHREADS, photos=timing), open(a.timing, "w"), indent=1)
    if a.features:
        pickle.dump(feats, open(a.features, "wb"))
    n = sum(len(v) for v in out.values())
    print(f"{n} photos, {sum(len(x) for v in out.values() for x in v.values())} areas -> {a.out} "
          f"({T_END - T_START:.2f} s after interpreter start)")
    if bad and a.strict:
        sys.exit(3)


def main():
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    sub = ap.add_subparsers(dest="cmd", required=True)
    pr = sub.add_parser("predict")
    pr.add_argument("--images", required=True)
    pr.add_argument("--model", required=True)
    pr.add_argument("--out", required=True)
    pr.add_argument("--timing")
    pr.add_argument("--features")
    pr.add_argument("--threads", type=int, default=2)
    pr.add_argument("--planogram", default=os.path.join(ROOT, "data/planogram.json"))
    pr.add_argument("--expect-images", type=int, help="warn if the number of photos found differs (26 on validation day)")
    pr.add_argument("--expect-areas", type=int, help="warn if the number of areas predicted differs (289 on validation day)")
    pr.add_argument("--strict", action="store_true", help="exit with code 3 after writing the file when an --expect check fails")
    pr.add_argument("--p-stock", action="store_true", help="also write p_stock = [p_empty, p_half, p_full] for every area")
    pr.add_argument("--full-weight", type=float, default=1.0, help="multiply p(full) by this before choosing the level (default 1.0, no change; "
                    "0.5 answers a lower level when unsure: about -3 points per 289 areas under the team labels, about +30 under a stricter reading; p_stock is not changed)")
    a = ap.parse_args()
    predict(a)


if __name__ == "__main__":
    main()
