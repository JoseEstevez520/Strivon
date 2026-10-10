"""Image-only Strivon ensemble (lane I final): self-contained port of exp_e01_wcv3.py + exp_v01_family.py for predict.py.

Stock = w1 * h01d + w2 * r01b + w3 * cnn (weights on the simplex, step 0.1, chosen once at training time by challenge points on
inner GroupKFold(3)-by-photo out-of-fold probabilities of the training rows, exactly as exp_e01_ens_lib.fit_weights):
  h01d  exp_h01d_onehead.py: x01 pixel block (85) + h01 fill-level block (68 per crop x crate/x1/x1.6 crops) + product family
        one-hot (18) + per-slot relative features of the crate block (SlotRel, 71); 0.5 * standardised logistic (C by inner
        leave-one-camera-out points) + 0.5 * HistGradientBoosting.
  r01b  exp_r01b_refdiff2.py (default env: mean, MIN=2, empty+full references): x01 block + differences of the 48 px grey crop
        and HS histogram to the slot's mean empty / full training crops (57); same logistic + trees blend.
  cnn   exp_f01_lib.py: two-stream MobileNetV3-small (crate crop + polygon crop x1.1, 112 px) fine-tuned 6 epochs, seed 0.
Level = eval.decide(P). Compliance = exp_rb01_wbcomp.py (default) or exp_v01_family.py with V01_FEAT=hsv, V01_COMBINE=1 (--no-wb):
p01 HSV bank logistic AND NOT the planogram-family detector (crop closer to another family of the same camera than to its own, threshold picked on
inner benchmark-fold splits of the training rows). With wb (exp_rb01_comp.norm, RB_MODE=wb) every 48 px crop gets gray-world
channel gains before its hue-saturation histogram, for the bank crops at training and the checked crop at inference.

The code below mirrors the experiment files line by line (same row order, same seeds, same float types) so a model trained on
the same rows reproduces the run5 predictions. At inference only the photo being predicted and the model file are read.
"""
import os
import re
import sys

import cv2
import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import predict_lib as P  # noqa: E402
import eval as E  # noqa: E402

E01_MEMBERS = ["h01d", "r01b", "cnn"]
SIZE = (96, 96)
S48 = 48
S112 = 112
LEV = ["empty", "half", "full"]

# ---------------------------------------------------------------- planogram families (exp_h01_families, exp_p01_lib.english)
RULES = [
    ("banana", r"BANANA"), ("potato", r"BATATA"), ("citrus", r"CITR|LARANJA|CLEMENTINA|LIM[ÃA]O|LIMA\b"),
    ("apple", r"MA[CÇ][AÃÂ]"), ("pear", r"PERA\b"), ("mango", r"MANGA"), ("stone", r"PESSEGO|NECTARINA|ALPERCE|CEREJA"),
    ("melon", r"MELANCIA|MELAO|MELOA"), ("pineapple", r"ABACAXI"), ("onion", r"CEBOL|ALHO|GENGIBRE"), ("tomato", r"TOMATE"),
    ("cabbage", r"COUVE|ALFACE"), ("grape", r"UVA"), ("kiwi", r"KIWI"),
    ("tropical", r"MAMAO|PAPAIA|GOIABA|MARACUJA|ABACATE|PITAYA|GRANADILHA"),
    ("veg", r"PIMENTO|BERINGELA|CHUCHU|FEIJ|PEPINO|CURGETE|AB[OÓ]BORA|MORANGO"),
]
FAMILIES = [f for f, _ in RULES] + ["other"]
EN = [("BANANA", "bananas"), ("BATATA DOCE", "sweet potatoes"), ("BATATA", "potatoes"), ("CITR", "oranges"), ("LARANJA", "oranges"),
      ("CLEMENTINA", "clementines"), ("LIMÃO", "lemons"), ("LIMA", "limes"), ("MANGA", "mangoes"), ("PESSEGO", "peaches"),
      ("NECTARINA", "nectarines"), ("ALPERCE", "apricots"), ("MAÇ", "apples"), ("MACA", "apples"), ("PERA", "pears"),
      ("ABACAXI", "pineapples"), ("MELANCIA", "watermelons"), ("MELAO", "green melons"), ("MELOA", "melons"), ("UVA", "grapes"),
      ("CEREJA", "cherries"), ("KIWI", "kiwis"), ("CEBOLINHA", "shallots"), ("CEBOLA ROXA", "red onions"), ("CEBOLA", "onions"),
      ("ALHO", "garlic"), ("COUVE FLOR", "cauliflower"), ("COUVE BROCOLO", "broccoli"), ("COUVE ROXA", "red cabbage"),
      ("COUVE", "cabbage"), ("TOMATE CHERRY", "cherry tomatoes"), ("TOMATE", "tomatoes"), ("MORANGO", "strawberries"),
      ("PITAYA", "dragon fruit"), ("GOIABA", "guavas"), ("MARACUJA", "passion fruit"), ("GRANADILHA", "granadilla"),
      ("MAMAO", "papayas"), ("PAPAIA", "papayas"), ("GENGIBRE", "ginger"), ("ABÓBORA", "pumpkins"), ("ALFACE", "lettuce"),
      ("ABACATE", "avocados"), ("PIMENTO VERDE", "green peppers"), ("PIMENTO", "red peppers"), ("BERINGELA", "eggplants"),
      ("CHUCHU", "chayote"), ("FEIJ", "green beans"), ("PEPINO", "cucumbers"), ("CURGETE", "zucchini")]


def planogram_names(path):
    import json
    p = json.load(open(path))["Frutas e Legumes"]["cameras"]
    return {a["area_id"]: a["product_name"] for c in p.values() for a in c["products"]}


def h01_family(name):
    name = name.upper()
    for f, pat in RULES:
        if re.search(pat, name):
            return f
    return "other"


def packaged(name):
    name = name.upper()
    return float(bool(re.search(r"EMB|\bSC\b|SACO|\d+\s?GR?\b|(?<![/\d.])\d(\.\d)?\s?KG", name)))


def fam_onehot(name):
    v = np.zeros(len(FAMILIES) + 1)
    v[FAMILIES.index(h01_family(name))] = 1.0
    v[-1] = packaged(name)
    return v


def english(name):
    for k, v in EN:
        if k in name:
            return v
    return name.lower()


# ---------------------------------------------------------------- h01 fill-level block (verbatim from exp_h01_feats)
NB, BS = 8, 12


def _h01_masks(hsv):
    h, s, v = hsv[..., 0].astype(int), hsv[..., 1].astype(int), hsv[..., 2].astype(int)
    teal = (h >= 70) & (h <= 105) & (s >= 60) & (v >= 40)
    dark = v < 55
    grey = (s < 40) & (v >= 55) & (v < 215)
    white = (s < 40) & (v >= 215)
    return teal | dark | grey | white


def _bands(m):
    H, W = m.shape
    return m.reshape(NB, H // NB, W).mean((1, 2)), m.reshape(H, NB, W // NB).mean((0, 2))


def _occupancy(p, thr=0.5):
    cov = p > thr
    lead = int(np.argmax(cov)) if cov.any() else NB
    trail = int(np.argmax(cov[::-1])) if cov.any() else NB
    return [cov.mean(), p.min(), p.max(), lead / NB, trail / NB, float(np.polyfit(np.arange(NB), p, 1)[0])]


def h01_crop_feats(c):
    hsv = cv2.cvtColor(c, cv2.COLOR_BGR2HSV)
    s, v = hsv[..., 1] / 255.0, hsv[..., 2] / 255.0
    bg = _h01_masks(hsv)
    prod = (~bg) & (s > 0.35)
    f = []
    rp, cp = _bands(prod.astype(np.float32))
    bp, _ = _bands(bg.astype(np.float32))
    f += list(rp) + list(cp) + list(bp)
    f += _occupancy(rp) + _occupancy(cp)[:3]
    g = cv2.cvtColor(c, cv2.COLOR_BGR2GRAY)
    g2 = cv2.resize(g, (SIZE[0] // 2, SIZE[1] // 2), interpolation=cv2.INTER_AREA)
    tex = []
    for gg in (g, g2):
        lap = np.abs(cv2.Laplacian(gg, cv2.CV_32F)).mean()
        sx, sy = cv2.Sobel(gg, cv2.CV_32F, 1, 0), cv2.Sobel(gg, cv2.CV_32F, 0, 1)
        sob = np.sqrt(sx * sx + sy * sy).mean()
        tex += [np.log1p(lap), np.log1p(sob)]
    f += tex + [tex[0] - tex[2], tex[1] - tex[3]]
    blk = g.reshape(SIZE[1] // BS, BS, SIZE[0] // BS, BS).astype(np.float32).std((1, 3))
    f += [blk.mean(), *np.percentile(blk, [25, 75]), (blk < 8).mean(), (blk < 15).mean()]
    f += list(blk.mean(1))
    f += list(np.percentile(s, [10, 25, 50, 75, 90])) + [(s > 0.35).mean(), (s > 0.5).mean()]
    f += list(np.percentile(v, [10, 50, 90]))
    hh = hsv[..., 0][prod]
    hist = np.histogram(hh, bins=6, range=(0, 180))[0].astype(np.float32) if hh.size else np.zeros(6, np.float32)
    f += list(hist / max(1.0, hist.sum()))
    return [float(x) for x in f]


NF = 68  # per-crop length of the h01 block (exp_h01_feats.NF)


# ---------------------------------------------------------------- r01 reference differencing (verbatim from exp_r01_refdiff)
def r01_prep(c):
    g = cv2.cvtColor(c, cv2.COLOR_BGR2GRAY).astype(np.float32)
    g = (g - g.mean()) / (g.std() + 1e-3)
    hs = cv2.cvtColor(c, cv2.COLOR_BGR2HSV)
    h = cv2.calcHist([hs], [0, 1], None, [8, 4], [0, 180, 0, 256]).ravel(); h /= h.sum()
    return g, h


def feats_vs(g, h, rg, rh):
    d = np.abs(g - rg)
    cells = d.reshape(4, S48 // 4, 4, S48 // 4).mean((1, 3)).ravel()
    bc = -np.log(np.sqrt(h * rh).sum() + 1e-6)
    cc = (g * rg).mean()
    return np.concatenate([cells, [d.mean(), bc, cc]])


# ---------------------------------------------------------------- per-photo features
def hsv_of(c48):
    hsv = cv2.cvtColor(c48, cv2.COLOR_BGR2HSV)
    h = cv2.calcHist([hsv], [0, 1], None, [12, 4], [0, 180, 0, 256]).ravel()
    h /= h.sum() + 1e-9
    return np.sqrt(h)


def wb_norm(c):
    """exp_rb01_comp.norm with RB_MODE=wb: per-crop gray-world channel gains clipped to 0.67..1.5 (no p95 gain)."""
    f = c.astype(np.float32); m = f.reshape(-1, 3).mean(0) + 1e-3
    f *= np.clip(m.mean() / m, 0.67, 1.5)
    return np.clip(f, 0, 255).astype(np.uint8)


def photo_feats(im, aids, geo, t, cnn=True, wb=True):
    """Everything the ensemble needs from one photo. Returns dict of per-area arrays (rows follow aids)."""
    q, a2c = geo["quads"], geo["a2c"]
    D = {}
    with t("x01"):
        crate96 = {c: P._warp(im, geo["crate_quads"][c], SIZE) for c in sorted({a2c[a] for a in aids})}
        p10 = {a: P.area_crop(im, q[a], SIZE, 1.0) for a in aids}
        p16 = {a: P.area_crop(im, q[a], SIZE, 1.6) for a in aids}
        cfx = {c: P.crop_feats(v) for c, v in crate96.items()}
        D["Xb"] = np.array([P.crop_feats(p10[a]) + P.crop_feats(p16[a]) + cfx[a2c[a]] + [geo["shared"][a]] for a in aids], float)
    with t("h01"):
        cfh = {c: h01_crop_feats(v) for c, v in crate96.items()}
        D["Xh"] = np.array([cfh[a2c[a]] + h01_crop_feats(p10[a]) + h01_crop_feats(p16[a]) for a in aids], float)
    with t("r01"):
        c48 = [P.area_crop(im, q[a], (S48, S48)) for a in aids]
        gh = [r01_prep(c) for c in c48]
        D["G"] = np.array([g for g, _ in gh]); D["Hr"] = np.array([h for _, h in gh])
    if wb:  # compliance histograms after gray-world gains (exp_rb01_wbcomp.py)
        with t("wb"):
            c48h = [wb_norm(c) for c in c48]
    else:
        c48h = c48
    with t("comp"):
        D["Hsv"] = np.array([hsv_of(c) for c in c48h], np.float32)
    if cnn:
        with t("cnn"):
            D["U8"] = cnn_crops(im, aids, geo)
    return D


# ---------------------------------------------------------------- h01d (exp_h01_lib.OneHead)
H_CS = [0.003, 0.01, 0.03, 0.1, 0.3]
X_CS = [0.003, 0.01, 0.03, 0.1, 0.3, 1.0]


def _hgb(seed=0):
    from sklearn.ensemble import HistGradientBoostingClassifier
    return HistGradientBoostingClassifier(max_depth=3, learning_rate=0.05, max_iter=200, l2_regularization=1.0,
                                          min_samples_leaf=20, random_state=seed)


def _loco_C(X, y, cams, CS):
    best = None
    for C in CS:
        s = 0.0
        for c in np.unique(cams):
            m = cams == c
            s += P._points(P._proba(P._lr(C).fit(X[~m], y[~m]), X[m]), y[m])
        if best is None or s > best[0]:
            best = (s, C)
    return best[1]


def _blend(lin, hgb, Xt):
    P2 = np.zeros((len(Xt), 3)); P2[:, hgb.classes_] = hgb.predict_proba(Xt)
    return 0.5 * P._proba(lin, Xt) + 0.5 * P2


def slotrel_fit(aids, y, Xc, famof):
    mu, sd = Xc.mean(0), Xc.std(0) + 1e-6
    Z = (Xc - mu) / sd
    proto = {}
    for lvl in (1, 2):
        by_slot, by_fam = {}, {}
        for a, z, t in zip(aids, Z, y):
            if t == lvl:
                by_slot.setdefault(a, []).append(z)
                by_fam.setdefault(famof[a], []).append(z)
        proto[lvl] = ({a: np.mean(v, 0) for a, v in by_slot.items() if len(v) >= 3},
                      {f: np.mean(v, 0) for f, v in by_fam.items() if len(v) >= 3},
                      Z[y == lvl].mean(0) if (y == lvl).any() else Z.mean(0))
    return dict(mu=mu, sd=sd, proto=proto)


def slotrel_transform(R, aids, Xc, famof):
    Z = (Xc - R["mu"]) / R["sd"]

    def lookup(lvl, aid):
        s, f, g = R["proto"][lvl]
        return s.get(aid, f.get(famof[aid], g))
    out = []
    for a, z in zip(aids, Z):
        pf, ph = lookup(2, a), lookup(1, a)
        d = z - pf
        out.append(np.concatenate([d, [np.linalg.norm(d), np.linalg.norm(z - ph), np.linalg.norm(d) - np.linalg.norm(z - ph)]]))
    return np.array(out)


def h01d_design(m, Xb, Xh, aids, fam1h, famof):
    return np.concatenate([Xb, Xh, np.array([fam1h[a] for a in aids]),
                           slotrel_transform(m["rel"], aids, Xh[:, :NF], famof)], 1)


def h01d_fit(Xb, Xh, aids, y, cams, fam1h, famof):
    m = dict(rel=slotrel_fit(aids, y, Xh[:, :NF], famof))
    X = h01d_design(m, Xb, Xh, aids, fam1h, famof)
    C = _loco_C(X, y, cams, H_CS)
    m.update(C=C, lin=P._lr(C).fit(X, y), hgb=_hgb().fit(X, y))
    return m


def h01d_proba(m, Xb, Xh, aids, fam1h, famof):
    return _blend(m["lin"], m["hgb"], h01d_design(m, Xb, Xh, aids, fam1h, famof))


# ---------------------------------------------------------------- r01b (exp_r01b_refdiff2 with default env)
R01_LVS = ("empty", "full")
R01_MIN = 2


def r01_acc(aids, lvls, owns, G, Hr):
    acc = {}
    for a, lv, o, g, h in zip(aids, lvls, owns, G, Hr):
        if lv == "half":
            continue
        for k in ((a, lv), ("*", lv)):
            acc.setdefault(k, []).append((o, g, h))
    return {k: (np.array([x[0] for x in v]), np.array([x[1] for x in v]), np.array([x[2] for x in v])) for k, v in acc.items()}


def r01_ref(acc, aid, lv, own):
    for k, minn in ((aid, R01_MIN), ("*", 1)):
        a = acc.get((k, lv))
        if a is None:
            continue
        ids, G, H = a
        if own is not None:
            m = ids != own; G, H = G[m], H[m]
        if len(G) < minn or len(G) == 0:
            continue
        return np.mean(G, 0), np.mean(H, 0)
    return None


def r01_feats(G, Hr, refs):
    """refs: list (per row) of [ref_empty, ref_full], each (g, h) or None."""
    out = []
    for g, h, rr in zip(G, Hr, refs):
        fs = [np.zeros(19) if rf is None else feats_vs(g, h, *rf) for rf in rr]
        fs.append(fs[0] - fs[1])
        out.append(np.concatenate(fs))
    return np.array(out)


def r01b_fit(Xb, G, Hr, aids, lvls, owns, y, cams, all_aids):
    acc = r01_acc(aids, lvls, owns, G, Hr)
    Xr = r01_feats(G, Hr, [[r01_ref(acc, a, lv, o) for lv in R01_LVS] for a, o in zip(aids, owns)])
    X = np.hstack([Xb, Xr])
    C = _loco_C(X, y, cams, X_CS)
    refs = {a: [r01_ref(acc, a, lv, None) for lv in R01_LVS] for a in all_aids}
    return dict(C=C, lin=P._lr(C).fit(X, y), hgb=_hgb(0).fit(X, y), refs=refs)


def r01b_proba(m, Xb, G, Hr, aids):
    return _blend(m["lin"], m["hgb"], np.hstack([Xb, r01_feats(G, Hr, [m["refs"][a] for a in aids])]))


# ---------------------------------------------------------------- CNN (verbatim from exp_f01_lib)
MEAN = np.array([0.485, 0.456, 0.406], np.float32)
STD = np.array([0.229, 0.224, 0.225], np.float32)
DST112 = np.array([[0, 0], [S112, 0], [S112, S112], [0, S112]], np.float32)
ARCH = "mobilenetv3_small_100.lamb_in1k"
CNN_CFG = dict(epochs=6, bs=32, lr=1e-3, freeze_early=2)


def cnn_crops(im, aids, geo):
    out = np.zeros((len(aids), 2, S112, S112, 3), np.uint8)
    cc = {}
    for i, a in enumerate(aids):
        cid = geo["a2c"][a]
        if cid not in cc:
            M = cv2.getPerspectiveTransform(geo["crate_quads"][cid], DST112)
            cc[cid] = cv2.warpPerspective(im, M, (S112, S112), borderMode=cv2.BORDER_REFLECT)[:, :, ::-1]
        out[i, 0] = cc[cid]
        out[i, 1] = P.area_crop(im, geo["quads"][a], (S112, S112), 1.1)[:, :, ::-1]
    return out


def _torch(threads):
    import torch
    torch.set_num_threads(threads)
    return torch


def make_net(torch, pretrained, frozen=False, freeze_early=2):
    import timm
    nn = torch.nn

    class _Net(nn.Module):
        def __init__(self):
            super().__init__()
            self.b = timm.create_model(ARCH, pretrained=pretrained, num_classes=0)
            d = int(self.b(torch.zeros(1, 3, 64, 64)).shape[1])
            self.drop = nn.Dropout(0.2)
            self.head = nn.Linear(2 * d + 1, 3)

        def feats(self, x):
            B = x.shape[0]
            return self.b(x.flatten(0, 1)).view(B, -1)

        def forward(self, x, sh):
            return self.head(self.drop(torch.cat([self.feats(x), sh[:, None]], 1)))

    m = _Net()
    if freeze_early:
        for mod in [m.b.conv_stem, m.b.bn1] + list(m.b.blocks[:freeze_early]):
            for p in mod.parameters():
                p.requires_grad = False
    if frozen:
        for p in m.b.parameters():
            p.requires_grad = False
    return m


def to_tensor(torch, Xu8):
    x = Xu8.astype(np.float32) / 255.0
    x = (x - MEAN) / STD
    return torch.from_numpy(np.ascontiguousarray(x.transpose(0, 1, 4, 2, 3)))


def augment(Xu8, rng):
    out = np.empty_like(Xu8)
    for i in range(Xu8.shape[0]):
        for j in range(2):
            im = Xu8[i, j]
            if rng.random() < 0.5:
                im = im[:, ::-1]
            if rng.random() < 0.5:
                im = im[::-1]
            ang = rng.uniform(-8, 8); sc = rng.uniform(0.92, 1.08)
            tx, ty = rng.uniform(-0.06, 0.06, 2) * S112
            M = cv2.getRotationMatrix2D((S112 / 2, S112 / 2), ang, sc); M[:, 2] += (tx, ty)
            im = cv2.warpAffine(np.ascontiguousarray(im), M, (S112, S112), borderMode=cv2.BORDER_REFLECT)
            a = rng.uniform(0.85, 1.15); b = rng.uniform(-15, 15)
            out[i, j] = np.clip(im.astype(np.float32) * a + b, 0, 255).astype(np.uint8)
    return out


def cnn_train(Xu8, sh, y, threads, epochs=6, bs=32, lr=1e-3, seed=0, freeze_early=2, log=None):
    import time
    torch = _torch(threads)
    torch.manual_seed(seed)
    rng = np.random.default_rng(seed)
    m = make_net(torch, True, freeze_early=freeze_early)
    opt = torch.optim.AdamW([{"params": [p for p in m.b.parameters() if p.requires_grad], "lr": lr * 0.5},
                             {"params": m.head.parameters(), "lr": lr}], weight_decay=1e-4)
    n = len(y)
    steps = epochs * int(np.ceil(n / bs))
    sched = torch.optim.lr_scheduler.OneCycleLR(opt, max_lr=[g["lr"] for g in opt.param_groups], total_steps=steps,
                                                pct_start=0.15)
    lossf = torch.nn.CrossEntropyLoss(label_smoothing=0.05)
    yt = torch.from_numpy(y.astype(np.int64)); sht = torch.from_numpy(sh)
    t0 = time.time()
    for ep in range(epochs):
        m.train()
        perm = rng.permutation(n); tot = 0.0
        for k in range(0, n, bs):
            b = perm[k:k + bs]
            if len(b) < 2:
                continue
            x = to_tensor(torch, augment(Xu8[b], rng))
            loss = lossf(m(x, sht[b]), yt[b])
            opt.zero_grad(); loss.backward(); opt.step(); sched.step()
            tot += float(loss.detach()) * len(b)
        if log:
            log(f"      cnn seed {seed} ep{ep} loss {tot / n:.3f} ({time.time() - t0:.0f}s)")
    m.eval()
    return m


def cnn_logits(torch, m, Xu8, sh, bs=128):
    out = []
    with torch.inference_mode():
        for k in range(0, len(Xu8), bs):
            out.append(m(to_tensor(torch, Xu8[k:k + bs]), torch.from_numpy(sh[k:k + bs])).numpy())
    return np.concatenate(out)


def cnn_state(m):
    return {k: v.detach().cpu().numpy().copy() for k, v in m.state_dict().items()}


def cnn_load(state, threads):
    torch = _torch(threads)
    m = make_net(torch, False)
    m.load_state_dict({k: torch.from_numpy(v) for k, v in state.items()})
    m.eval()
    return torch, m


def softmax(z):
    z = z - z.max(1, keepdims=True)
    e = np.exp(z)
    return e / e.sum(1, keepdims=True)


# ---------------------------------------------------------------- ensemble weights (exp_e01_ens_lib)
def _simplex(m, step=0.1):
    import itertools
    n = int(round(1 / step))
    for c in itertools.product(range(n + 1), repeat=m):
        if sum(c) == n:
            yield np.array(c, float) / n


def e01_points(Pr, y):
    return int(sum(E.POINTS[E.LEVELS.index(E.decide(p)), t] for p, t in zip(Pr, y)))


def fit_weights(Os, y):
    m = len(Os)
    best = None
    for w in _simplex(m):
        s = e01_points(sum(wi * O for wi, O in zip(w, Os)), y)
        d = np.abs(w - 1 / m).sum()
        if best is None or (s, -d) > (best[0], -best[1]):
            best = (s, d, w)
    return best[2], best[0]


# ---------------------------------------------------------------- compliance: p01 HSV bank + v01 family detector
def _d32(F, i_vec):
    return float(1 - (F @ i_vec).max())


def p01_feats(Hq, aids, bank):
    X = []
    for q, a in zip(Hq, aids):
        comp, nc = bank.get(a, (None, None))
        dc = np.nan if comp is None or len(comp) == 0 else _d32(comp, q)
        dn = np.nan if nc is None or len(nc) == 0 else _d32(nc, q)
        dc = 1.0 if np.isnan(dc) else dc
        X.append([dc, 0.0 if np.isnan(dn) else dc - dn, float(not np.isnan(dn))])
    return np.array(X)


def p01_bank(Hq, aids, ncf):
    comp, nc = {}, {}
    for h, a, n in zip(Hq, aids, ncf):
        (nc if n else comp).setdefault(a, []).append(h)
    return {a: (np.array(comp[a]) if a in comp else None, np.array(nc[a]) if a in nc else None) for a in set(comp) | set(nc)}


def p01_fit(Hq, aids, ncf, folds):
    from sklearn.linear_model import LogisticRegression
    X, y = [], []
    for f in sorted(set(folds)):
        inn, out = folds == f, folds != f
        bank = p01_bank(Hq[out], aids[out], ncf[out])
        X.append(p01_feats(Hq[inn], aids[inn], bank)); y += [int(v) for v in ncf[inn]]
    lr = LogisticRegression(C=1.0, max_iter=2000).fit(np.concatenate(X), np.array(y))
    return dict(lr=lr, bank=p01_bank(Hq, aids, ncf))


def p01_ok(m, Hq, aids):
    return ~(m["lr"].predict_proba(p01_feats(Hq, aids, m["bank"]))[:, 1] > 0.5)


def v01_norm(Hq):
    F = np.asarray(Hq, np.float32)
    return F / (np.linalg.norm(F, axis=1, keepdims=True) + 1e-9)


def v01_banks(Fn, cams, aids, lvls, ok, enf):
    own, emp = {}, {}
    for f, c, a, lv, k in zip(Fn, cams, aids, lvls, ok):
        if not k:
            continue
        if lv == "empty":
            emp.setdefault(c, []).append(f)
        else:
            own.setdefault((c, enf[a]), []).append(f)
    fam_all = {}
    for (c, fm), v in own.items():
        fam_all.setdefault(fm, []).extend(v)
    return dict(own={k: np.array(v) for k, v in own.items()}, emp={k: np.array(v) for k, v in emp.items()},
                fam_all={k: np.array(v) for k, v in fam_all.items()})


def v01_score(Fn, cams, aids, bk, enf):
    def d(i_vec, B):
        return float(1 - (B @ i_vec).max()) if B is not None and len(B) else np.nan
    s = []
    for f, c, a in zip(Fn, cams, aids):
        fm = enf[a]
        d_own = d(f, bk["fam_all"].get(fm))
        oth = [v for (cc, g), v in bk["own"].items() if cc == c and g != fm]
        d_oth = d(f, np.concatenate(oth) if oth else None)
        d_emp = d(f, bk["emp"].get(c))
        margin = d_own - d_oth
        notempty = not (d_emp < d_oth)
        s.append(-np.inf if (np.isnan(margin) or not notempty) else margin)
    return np.array(s)


def v01_threshold(s, y, min_margin=0.0):
    best, tb = 0, np.inf
    for t in np.unique(s[np.isfinite(s)]):
        if t < min_margin:
            continue
        p = s >= t
        pts = 3 * (p & (y == 1)).sum() - 3 * (p & (y == 0)).sum()
        if pts > best:
            best, tb = pts, t
    return tb


def v01_fit(Hq, cams, aids, lvls, ok, folds, enf):
    Fn = v01_norm(Hq)
    S, Y = [], []
    for g in sorted(set(folds)):
        inn, out = folds == g, folds != g
        bk = v01_banks(Fn[out], cams[out], aids[out], lvls[out], ok[out], enf)
        S.append(v01_score(Fn[inn], cams[inn], aids[inn], bk, enf)); Y.append((~ok[inn]).astype(int))
    t = v01_threshold(np.concatenate(S), np.concatenate(Y))
    return dict(t=float(t), bank=v01_banks(Fn, cams, aids, lvls, ok, enf))


def v01_nc(m, Hq, cam, aids, enf):
    return v01_score(v01_norm(Hq), [cam] * len(aids), aids, m["bank"], enf) >= m["t"]


# ---------------------------------------------------------------- training and inference entry points
def train_ensemble(D, geo, names, threads, log=print, wb=True):
    """D: dict of row arrays in run5 row order (sorted camera, sorted image, planogram area order, labelled areas only):
    Xb, Xh, G, Hr, Hsv, U8, aid, cam, own ('cam'+'img'), grp ('cam|img'), lvl, ok (compliant), fold."""
    import time
    import warnings
    warnings.filterwarnings("ignore")
    from sklearn.model_selection import GroupKFold
    aids, cams, lvls = D["aid"], D["cam"], D["lvl"]
    assert D["Xh"].shape[1] == 3 * NF and D["Xb"].shape[1] == P.N_STOCK, (D["Xh"].shape, D["Xb"].shape)
    y = np.array([LEV.index(v) for v in lvls])
    all_aids = list(geo["quads"])
    famof = {a: h01_family(names[a]) for a in all_aids}
    fam1h = {a: fam_onehot(names[a]) for a in all_aids}
    enf = {a: english(names[a]) for a in all_aids}
    sh = np.array([geo["shared"][a] for a in aids], np.float32)

    def fit_h(ix):
        return h01d_fit(D["Xb"][ix], D["Xh"][ix], aids[ix], y[ix], cams[ix], fam1h, famof)

    def fit_r(ix):
        return r01b_fit(D["Xb"][ix], D["G"][ix], D["Hr"][ix], aids[ix], lvls[ix], D["own"][ix], y[ix], cams[ix], all_aids)

    def prob_h(m, ix):
        return h01d_proba(m, D["Xb"][ix], D["Xh"][ix], aids[ix], fam1h, famof)

    def prob_r(m, ix):
        return r01b_proba(m, D["Xb"][ix], D["G"][ix], D["Hr"][ix], aids[ix])

    allix = np.arange(len(y))
    t0 = time.time()
    O = {n: np.zeros((len(y), 3)) for n in E01_MEMBERS}
    for j, (a, b) in enumerate(GroupKFold(3).split(y, y, D["grp"])):
        O["h01d"][b] = prob_h(fit_h(a), b)
        O["r01b"][b] = prob_r(fit_r(a), b)
        torch = _torch(threads)
        cm = cnn_train(D["U8"][a], sh[a], y[a], threads, seed=100 + j, log=log, **CNN_CFG)
        O["cnn"][b] = softmax(cnn_logits(torch, cm, D["U8"][b], sh[b]).astype(np.float32))
        log(f"    inner fold {j}: {len(a)} -> {len(b)} rows ({time.time() - t0:.0f}s)")
    w, oof_pts = fit_weights([O[n] for n in E01_MEMBERS], y)
    log(f"    weights {dict(zip(E01_MEMBERS, np.round(w, 2).tolist()))} (inner OOF points {oof_pts:+d}; members "
        + " ".join(f"{n} {e01_points(O[n], y):+d}" for n in E01_MEMBERS) + ")")
    mh, mr = fit_h(allix), fit_r(allix)
    cm = cnn_train(D["U8"], sh, y, threads, seed=0, log=log, **CNN_CFG)
    log(f"    final members fitted ({time.time() - t0:.0f}s), h01d C={mh['C']} r01b C={mr['C']}")
    folds = np.asarray(D["fold"])
    ok = np.asarray(D["ok"], bool)
    comp_p = p01_fit(D["Hsv"], aids, ~ok, folds)
    comp_v = v01_fit(D["Hsv"], cams, aids, lvls, ok, folds, enf)
    log(f"    compliance: v01 family threshold {comp_v['t']}")
    return dict(weights=w, oof_points=oof_pts, h01d=mh, r01b=mr, cnn=cnn_state(cm), cnn_arch=ARCH,
                comp_p01=comp_p, comp_v01=comp_v, comp_wb=wb, famof=famof, fam1h=fam1h, enf=enf)


class Runtime:
    """Loaded ensemble: the CNN is built once (torch import + timm model + state_dict)."""

    def __init__(self, ens, geo, threads):
        self.e, self.geo = ens, geo
        self.torch, self.net = cnn_load(ens["cnn"], threads)

    def predict_photo(self, im, cam, aids, t):
        e = self.e
        D = photo_feats(im, aids, self.geo, t, wb=e.get("comp_wb", False))
        sh = np.array([self.geo["shared"][a] for a in aids], np.float32)
        with t("cnn"):
            Pc = np.asarray(softmax(cnn_logits(self.torch, self.net, D["U8"], sh).astype(np.float32)), float)
        with t("heads"):
            Ph = h01d_proba(e["h01d"], D["Xb"], D["Xh"], aids, e["fam1h"], e["famof"])
            Pr = r01b_proba(e["r01b"], D["Xb"], D["G"], D["Hr"], aids)
            Pm = dict(h01d=Ph, r01b=Pr, cnn=Pc)
            Pe = sum(wi * Pm[n] for wi, n in zip(e["weights"], E01_MEMBERS))
            lv = [E.decide(p) for p in Pe]
        with t("comp"):
            ok = p01_ok(e["comp_p01"], D["Hsv"], aids) & ~v01_nc(e["comp_v01"], D["Hsv"], cam, aids, e["enf"])
        feats_ok = all(np.isfinite(D[k]).all() for k in ("Xb", "Xh", "G", "Hr", "Hsv"))
        return lv, ok, Pe, Pm, feats_ok
