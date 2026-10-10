"""Single-image model: predicts an area from the photo under analysis only.

Sensei: "You should only consider information from the image under analysis." So, unlike
`supervised.py`, nothing here looks at the photos taken before or after. The model is learned from
our labels; at prediction time it only sees the CLIP embedding, colour and texture of the area in
the one photo, the CLIP text scores, and which area it is (the area id is part of the input, like
the planogram is).

Two variants:
  "single"      no other photo is used at prediction time.
  "single_ref"  adds the labelled training crops of the same area as references (instance-based
                learning: a nearest-neighbour vote inside the training set; still no other photo
                from the day being predicted).

Benchmark (LEADERBOARD.md): `python -m sensei bench` fits on 4 of André's folds, predicts the 5th,
tunes the decision only inside the training folds, and writes eval/benchmark/preds/<variant>.json.
"""
from __future__ import annotations

import json
import os
import pickle
import time
from pathlib import Path

import numpy as np

from . import clip_backend as cb
from . import config
from .decision import decide_stock
from .extract import AreaFeatures, discover, extract
from .planogram import Planogram, load_planogram

LEVELS = config.LEVEL_NAMES
LIDX = {k: i for i, k in enumerate(LEVELS)}
Key = tuple[str, str, str]
MODEL_PATH = Path(os.environ.get("SENSEI_SINGLE_MODEL", config.OUTPUTS_DIR / "single.pkl"))
BENCH = config.ROOT / "eval" / "benchmark"


# --------------------------------------------------------------------------- per-image features

class ImageFeaturizer:
    """Everything here depends on one crop (plus text prompts and the area id)."""

    def __init__(self, pg: Planogram):
        self.pg = pg
        self.area_ids = [a.area_id for a in pg.areas]
        self.aidx = {a: i for i, a in enumerate(self.area_ids)}
        self.ls = cb.logit_scale()
        self._stock_T: dict[str, np.ndarray] = {}
        fam_info = {}
        for a in pg.areas:
            fam_info.setdefault(a.info.family, a.info)
        self.fams = sorted(fam_info)
        T = cb.embed_texts([f"a photo of {fam_info[f].description}" for f in self.fams])
        self.fam_T = T / np.linalg.norm(T, axis=1, keepdims=True)

    def _stock_text(self, noun):
        if noun not in self._stock_T:
            P = cb.stock_prompts(noun)
            T = np.stack([cb.embed_texts(P[x]).mean(0) for x in ("empty", "half", "full")])
            self._stock_T[noun] = T / np.linalg.norm(T, axis=1, keepdims=True)
        return self._stock_T[noun]

    def dense(self, k: Key, f: AreaFeatures) -> np.ndarray:
        a = self.pg.area(k[2])
        e = f.emb
        zs = cb.softmax(self.ls * self._stock_text(a.info.prompt_noun) @ e)
        cam_fams = sorted({x.info.family for x in self.pg.cameras[k[0]]})
        idx = [self.fams.index(x) for x in cam_fams]
        fp = cb.softmax(self.ls * self.fam_T[idx] @ e)
        p_exp = float(fp[cam_fams.index(a.info.family)])
        return np.concatenate([e, np.sqrt(f.hist), f.scalars, np.log(zs + 1e-4), [p_exp, float(fp.max())]]).astype(np.float32)


# --------------------------------------------------------------------------- model

class SingleModel:
    def __init__(self, use_refs: bool, C: float = 0.05):
        self.use_refs = use_refs
        self.C = C
        self.bias = (0.0, 0.0, 0.5)  # empty bias, full bias, compliance threshold

    # reference features: similarity-weighted label vote among training crops of the same area
    def _refs(self, keys, X_emb, exclude_self: bool):
        out = np.zeros((len(keys), 6), np.float32)
        for i, k in enumerate(keys):
            bank = self.bank.get(k[2])
            if bank is None:
                out[i] = [1 / 3, 1 / 3, 1 / 3, 1.0, 0.0, 0.0]
                continue
            E, Y, C, names = bank
            s = E @ X_emb[i]
            if exclude_self:
                s = np.where(names == f"{k[0]}/{k[1]}", -1.0, s)
            top = np.argsort(-s)[:4]
            w = np.clip(s[top], 0, None) ** 8 + 1e-9
            dist = np.zeros(3)
            for j, wj in zip(top, w):
                dist[Y[j]] += wj
            out[i] = [*(dist / w.sum()), float((C[top] * w).sum() / w.sum()), float(s[top[0]]), float(s[top].mean())]
        return out

    def _design(self, keys, D, exclude_self=False):
        emb = D[:, :512] / (np.linalg.norm(D[:, :512], axis=1, keepdims=True) + 1e-9)
        onehot = np.zeros((len(keys), len(self.area_ids)), np.float32)
        for i, k in enumerate(keys):
            onehot[i, self.aidx[k[2]]] = 1.0
        parts = [D, onehot]
        if self.use_refs:
            parts.append(self._refs(keys, emb, exclude_self) * 3.0)
        return np.hstack(parts), emb

    def fit(self, keys, D, y_stock, y_comp, area_ids):
        from sklearn.linear_model import LogisticRegression
        from sklearn.preprocessing import StandardScaler

        self.area_ids = area_ids
        self.aidx = {a: i for i, a in enumerate(area_ids)}
        emb = D[:, :512] / (np.linalg.norm(D[:, :512], axis=1, keepdims=True) + 1e-9)
        self.bank = {}
        if self.use_refs:
            by = {}
            for i, k in enumerate(keys):
                by.setdefault(k[2], []).append(i)
            for aid, idx in by.items():
                idx = np.array(idx)
                self.bank[aid] = (emb[idx], y_stock[idx], y_comp[idx].astype(float),
                                  np.array([f"{keys[j][0]}/{keys[j][1]}" for j in idx]))
        X, _ = self._design(keys, D, exclude_self=True)
        self.scaler = StandardScaler().fit(X)
        Xs = self.scaler.transform(X)
        self.ms = LogisticRegression(C=self.C, max_iter=3000).fit(Xs, y_stock)
        self.mc = LogisticRegression(C=self.C, max_iter=3000).fit(Xs, y_comp) if len(set(y_comp)) > 1 else None
        return self

    def proba(self, keys, D):
        X, _ = self._design(keys, D)
        Xs = self.scaler.transform(X)
        ps = np.zeros((len(keys), 3))
        ps[:, self.ms.classes_] = self.ms.predict_proba(Xs)
        pc = self.mc.predict_proba(Xs)[:, list(self.mc.classes_).index(1)] if self.mc is not None else np.ones(len(keys))
        return ps, pc

    def decide(self, ps, pc):
        be, bf, th = self.bias
        out = []
        for s, c in zip(ps, pc):
            s = s.copy()
            s[0] *= np.exp(be)
            s[2] *= np.exp(bf)
            lvl, val, _ = decide_stock(s)
            out.append((lvl, val, bool(c >= th)))
        return out


# Gradient boosting on the same per-image features, and the 50/50 blend with the logistic
# regression. The blend is the best single-image model on the benchmark (3253 vs 3205) at the
# same cost per photo, since both read the same CLIP features.
class GBM(SingleModel):
    """Gradient boosting on PCA of the embedding + the rest + area index."""

    def fit(self, keys, D, ys, yc, area_ids):
        from sklearn.decomposition import PCA
        from sklearn.ensemble import HistGradientBoostingClassifier

        self.area_ids = area_ids
        self.aidx = {a: i for i, a in enumerate(area_ids)}
        self.pca = PCA(48, random_state=0).fit(D[:, :512])
        X = self._x(keys, D)
        cat = [X.shape[1] - 1]
        self.ms = HistGradientBoostingClassifier(max_iter=300, learning_rate=0.05, max_leaf_nodes=15, l2_regularization=1.0,
                                                 categorical_features=cat, random_state=0).fit(X, ys)
        self.mc = HistGradientBoostingClassifier(max_iter=200, learning_rate=0.05, max_leaf_nodes=15, l2_regularization=1.0,
                                                 categorical_features=cat, random_state=0).fit(X, yc) if len(set(yc)) > 1 else None
        return self

    def _x(self, keys, D):
        a = np.array([[self.aidx[k[2]]] for k in keys], np.float32)
        return np.hstack([self.pca.transform(D[:, :512]), D[:, 512:], a])

    def proba(self, keys, D):
        X = self._x(keys, D)
        ps = np.zeros((len(keys), 3))
        ps[:, self.ms.classes_] = self.ms.predict_proba(X)
        pc = self.mc.predict_proba(X)[:, list(self.mc.classes_).index(1)] if self.mc is not None else np.ones(len(keys))
        return ps, pc


class Blend(SingleModel):
    def __init__(self, use_refs=False, C=0.05, w=0.5):
        super().__init__(use_refs, C)
        self.w = w

    def fit(self, keys, D, ys, yc, area_ids):
        self.area_ids = area_ids
        self.a = SingleModel(False, self.C).fit(keys, D, ys, yc, area_ids)
        self.b = GBM(False).fit(keys, D, ys, yc, area_ids)
        return self

    def proba(self, keys, D):
        pa, ca = self.a.proba(keys, D)
        pb, cb_ = self.b.proba(keys, D)
        return self.w * pa + (1 - self.w) * pb, self.w * ca + (1 - self.w) * cb_




def make_model(kind: str = "blend", use_refs: bool = False) -> SingleModel:
    if kind == "lr":
        return SingleModel(use_refs)
    if kind == "gbm":
        return GBM(False)
    return Blend(False, 0.05, 0.5)


def _points(decisions, y_stock, y_comp):
    pts = 0
    for (lvl, val, comp), ys, yc in zip(decisions, y_stock, y_comp):
        pts += 1 if comp == bool(yc) else -2
        p = LIDX[lvl]
        pts += 1 if p == ys else (-2 if p < ys else -3)
    return pts


def _tune(model: SingleModel, keys, D, ys, yc, folds_of_train):
    """Pick the decision biases with an inner CV that only uses the training photos."""
    oof_s = np.zeros((len(keys), 3))
    oof_c = np.zeros(len(keys))
    for f in sorted(set(folds_of_train)):
        tr = np.array([i for i, g in enumerate(folds_of_train) if g != f])
        te = np.array([i for i, g in enumerate(folds_of_train) if g == f])
        m = make_model(getattr(model, "kind", "lr"), model.use_refs).fit([keys[i] for i in tr], D[tr], ys[tr], yc[tr], model.area_ids)
        oof_s[te], oof_c[te] = m.proba([keys[i] for i in te], D[te])
    best = (-1e9, (0.0, 0.0, 0.5))
    for be in np.linspace(-1, 1, 9):
        for bf in np.linspace(-1, 1, 9):
            for th in (0.3, 0.4, 0.5, 0.6):
                model.bias = (be, bf, th)
                p = _points(model.decide(oof_s, oof_c), ys, yc)
                if p > best[0] or (p == best[0] and abs(be) + abs(bf) < abs(best[1][0]) + abs(best[1][1])):
                    best = (p, (float(be), float(bf), th))
    model.bias = best[1]
    return model


# --------------------------------------------------------------------------- data

def _features(pg, log=print):
    refs = discover(config.IMAGES_DIR, pg)
    feats = extract(refs, pg, log=log)
    fz = ImageFeaturizer(pg)
    keys = sorted(feats)
    D = np.stack([fz.dense(k, feats[k]) for k in keys])
    return keys, D, {k: i for i, k in enumerate(keys)}


def training_labels(log=print) -> dict[Key, dict]:
    """Latest team labels + André's 13 clear product fixes; drops the curtain photos and the
    18 areas waiting on a rule (see annotations/andre/product_label_fixes.md)."""
    team = json.loads(config.LABELS_PATH.read_text(encoding="utf-8"))
    out = {(c, i, a): dict(v) for c, imgs in team.items() for i, ar in imgs.items() for a, v in ar.items()}
    fixes_p = config.ROOT / "annotations" / "andre" / "product_label_fixes.json"
    if fixes_p.exists():
        fx = json.loads(fixes_p.read_text(encoding="utf-8"))
        n_fix = n_drop = 0
        for it in fx:
            k = (str(it["camera"]), it["image"], it["area_id"])
            if k not in out:
                continue
            if it["decision"] == "fix":
                out[k]["planogram_compliant"] = it["andre"] == "right product"
                n_fix += 1
            else:  # "open rule: ..." -> not used until the team settles it
                out.pop(k)
                n_drop += 1
        if log:
            log(f"labels: {n_fix} product fixes from André, {n_drop} areas waiting on a rule left out")
    key = json.loads((BENCH / "labels_v1.json").read_text(encoding="utf-8")) if (BENCH / "labels_v1.json").exists() else None
    if key is not None:  # the benchmark key already leaves out the curtain photos
        curtain = {(c, i) for c, imgs in team.items() for i in imgs if i not in key.get(c, {})}
        out = {k: v for k, v in out.items() if (k[0], k[1]) not in curtain}
    return out


# --------------------------------------------------------------------------- benchmark + train

def bench(variants=None, log=print):
    import sys

    sys.path.insert(0, str(config.ROOT / "eval"))
    import benchmark as B

    variants = variants or tuple(os.environ.get("SENSEI_BENCH_VARIANTS", "single,single_ref").split(","))
    tag = "" if cb.MODEL == "ViT-B-32" else "_" + cb.MODEL.replace("-", "").lower()
    pg = load_planogram()
    keys, D, pos = _features(pg, log)
    key = B.KEY
    area_ids = [a.area_id for a in pg.areas]
    results = {}
    for name in variants:
        t0 = time.time()
        preds: dict = {}
        for fold in range(5):
            train, test = B.train_test(fold)
            trs, tes = set(train), set(test)
            tk = [(c, i, a) for (c, i) in train for a, v in key.get(c, {}).get(i, {}).items() if (c, i, a) in pos]
            ys = np.array([LIDX[key[c][i][a]["stock_level"]] for c, i, a in tk])
            yc = np.array([int(key[c][i][a]["planogram_compliant"]) for c, i, a in tk])
            folds_tr = [B.FOLDS[f"{c}/{i}"] for c, i, _ in tk]
            Dt = D[[pos[k] for k in tk]]
            kind = "blend" if "blend" in name else "lr"
            m = make_model(kind, name == "single_ref").fit(tk, Dt, ys, yc, area_ids)
            m.kind = kind
            m = _tune(m, tk, Dt, ys, yc, folds_tr)
            ek = [(c, i, a.area_id) for (c, i) in test for a in pg.cameras[c] if (c, i, a.area_id) in pos]
            ps, pc = m.proba(ek, D[[pos[k] for k in ek]])
            for k, (lvl, val, comp) in zip(ek, m.decide(ps, pc)):
                preds.setdefault(k[0], {}).setdefault(k[1], {})[k[2]] = {"planogram_compliant": comp, "stock_level": lvl, "stock_value": val}
            assert not (trs & tes)
            log(f"  {name}: fold {fold} done, bias {m.bias}")
        out = BENCH / "preds" / f"{name}{tag}.json"
        out.parent.mkdir(parents=True, exist_ok=True)
        out.write_text(json.dumps(preds, indent=1))
        t = B.tally(preds)
        last = B.tally(preds, B.last_photos())
        results[name + tag] = {"total": t["total"], "max": t["max"], "ident": t["ident"], "stock": t["stock"],
                         "per_area": t["total"] / t["areas"], "last_per_area": last["total"] / last["areas"],
                         "per_578": round(t["total"] / t["areas"] * 289), "fit_seconds": round(time.time() - t0)}
        log(f"{name}{tag}: {results[name + tag]}")
    rp = BENCH / "preds" / "single_results.json"
    allres = json.loads(rp.read_text()) if rp.exists() else {}
    allres.update(results)
    rp.write_text(json.dumps(allres, indent=1))
    return results


def train(use_refs: bool = False, log=print, kind: str = "blend"):
    """Fit on every label (latest team labels + André's fixes) and save outputs/single.pkl."""
    pg = load_planogram()
    keys, D, pos = _features(pg, log)
    labels = training_labels(log)
    tk = [k for k in sorted(labels) if k in pos]
    ys = np.array([LIDX[labels[k]["stock_level"]] for k in tk])
    yc = np.array([int(labels[k]["planogram_compliant"]) for k in tk])
    import sys

    sys.path.insert(0, str(config.ROOT / "eval"))
    import benchmark as B

    folds = [B.FOLDS.get(f"{k[0]}/{k[1]}", hash(k[1]) % 5) for k in tk]
    Dt = D[[pos[k] for k in tk]]
    m = make_model(kind, use_refs).fit(tk, Dt, ys, yc, [a.area_id for a in pg.areas])
    m.kind = kind
    m = _tune(m, tk, Dt, ys, yc, folds)
    # learned prior per area, used only when a person hides the area (rounded down by the decision)
    m.area_prior = {}
    for aid in {k[2] for k in tk}:
        idx = [i for i, k in enumerate(tk) if k[2] == aid]
        dist = np.bincount(ys[idx], minlength=3) + 0.5
        m.area_prior[aid] = (dist / dist.sum(), float(yc[idx].mean()))
    m.featurizer = ImageFeaturizer(pg)
    for a in pg.areas:  # embed all prompts now, so prediction never has to
        m.featurizer._stock_text(a.info.prompt_noun)
    MODEL_PATH.parent.mkdir(parents=True, exist_ok=True)
    with MODEL_PATH.open("wb") as fh:
        pickle.dump(m, fh)
    log(f"saved {MODEL_PATH} ({kind}, {len(tk)} areas, refs={'on' if use_refs else 'off'}, bias {m.bias})")
    return m


def load() -> SingleModel | None:
    if not MODEL_PATH.exists():
        return None
    with MODEL_PATH.open("rb") as fh:
        return pickle.load(fh)


def predict(model: SingleModel, pg: Planogram, keys: list[Key], feats: dict[Key, AreaFeatures]):
    fz = getattr(model, "featurizer", None) or ImageFeaturizer(pg)
    fz.pg = pg
    D = np.stack([fz.dense(k, feats[k]) for k in keys])
    ps, pc = model.proba(keys, D)
    be, bf, th = model.bias
    out = {}
    for k, s, c in zip(keys, ps, pc):
        s = s.copy()
        s[0] *= np.exp(be)
        s[2] *= np.exp(bf)
        out[k] = (s / s.sum(), float(np.clip(0.5 + (c - th), 0, 1)))
    return out, model
