"""Supervised model trained on our labels.

The hidden validation photos come from the same 14 cameras on the same day, at times in between
the photos we labelled. So the strongest evidence for an area in a new photo is what the same area
looked like (and how we labelled it) in the photos just before and after, and how much the crop
changed since then. On top of that we keep the label-free signals (CLIP zero-shot, bare-container
share, colour/texture) so the model still works when the area changed.

Evaluation mimics the validation: whole photos are held out (GroupKFold by photo), and the
neighbour features of every row are built only from the photos in the training fold.
"""
from __future__ import annotations

import json
import os
import pickle
from pathlib import Path

import numpy as np

from . import config
from .decision import decide_compliance, decide_stock
from .extract import AreaFeatures
from .models import Observation

LEVELS = config.LEVEL_NAMES
LEVEL_IDX = {k: i for i, k in enumerate(LEVELS)}
MODEL_PATH = Path(os.environ.get("SENSEI_MODEL", config.OUTPUTS_DIR / "supervised.pkl"))
ANDRE_DETAILED = config.ROOT / "annotations" / "andre" / "labels_andre_detailed.json"

Key = tuple[str, str, str]


# --------------------------------------------------------------------------- labels

def load_training_labels(log=print) -> dict[Key, dict]:
    """Team labels (every area of every photo) with André's review on top.

    André reviewed the hardest cases and every suspected wrong product, so for
    planogram_compliant his answer wins where the two disagree. For stock we keep the team's
    labels except where André said empty and the team said half (Sensei's definition of empty).
    """
    team = json.loads(config.LABELS_PATH.read_text(encoding="utf-8"))
    # Rehearsal only: SENSEI_HOLDOUT=<json {camera: [images]}> hides those photos' labels.
    hold = json.loads(Path(os.environ["SENSEI_HOLDOUT"]).read_text()) if os.environ.get("SENSEI_HOLDOUT") else {}
    out: dict[Key, dict] = {}
    for cam, imgs in team.items():
        for img, areas in imgs.items():
            if img in hold.get(cam, []):
                continue
            for aid, v in areas.items():
                out[(cam, img, aid)] = dict(v)
    if ANDRE_DETAILED.exists():
        andre = json.loads(ANDRE_DETAILED.read_text(encoding="utf-8"))
        changed = to_empty = 0
        for cam, imgs in andre.items():
            for img, areas in imgs.items():
                for aid, v in areas.items():
                    k = (cam, img, aid)
                    if img in hold.get(cam, []):
                        continue
                    if k in out and out[k]["planogram_compliant"] != v["planogram_compliant"]:
                        out[k]["planogram_compliant"] = bool(v["planogram_compliant"])
                        changed += 1
                    # Sensei: "empty" = time to restock, one or two units left. André followed that
                    # literally; the team's "under a third of the crate" rule sometimes said half.
                    if k in out and v["stock_level"] == "empty" and out[k]["stock_level"] == "half":
                        out[k]["stock_level"] = "empty"
                        out[k]["stock_value"] = 0.0
                        to_empty += 1
        if log:
            log(f"labels: {len(out)} areas from eval/labels.json, {changed} product checks and {to_empty} half->empty taken from André's review")
    return out


# --------------------------------------------------------------------------- features

def _cos(a: np.ndarray | None, b: np.ndarray | None) -> float:
    if a is None or b is None or a.size == 0 or b.size == 0:
        return 0.0
    return float(a @ b / (np.linalg.norm(a) * np.linalg.norm(b) + 1e-9))


def _chi2(a: np.ndarray, b: np.ndarray) -> float:
    return float(0.5 * np.sum((a - b) ** 2 / (a + b + 1e-9)))


def _onehot(level: str) -> list[float]:
    v = [0.0, 0.0, 0.0]
    v[LEVEL_IDX[level]] = 1.0
    return v


N_NEIGH = 11  # exists, stock(3), comp, gap_h, emb_sim, hist_dist, ... (see _neigh)


def _neigh(cur_f: AreaFeatures, other_f: AreaFeatures | None, lab: dict | None, gap_h: float) -> list[float]:
    if lab is None or other_f is None:
        return [0.0, 0.0, 0.0, 0.0, 0.0, 9.0, 0.0, 2.0, 0.0, 0.0, 0.0]
    sim = _cos(cur_f.emb, other_f.emb)
    hd = _chi2(cur_f.hist, other_f.hist)
    sv = config.STOCK_LEVELS[lab["stock_level"]]
    return [1.0, *_onehot(lab["stock_level"]), float(lab["planogram_compliant"]), min(gap_h, 9.0), sim, hd,
            sv * sim, float(lab["planogram_compliant"]) * sim, float(cur_f.scalars[4] - other_f.scalars[4])]


def build_rows(
    keys: list[Key],
    feats: dict[Key, AreaFeatures],
    obs: dict[Key, Observation],
    labels: dict[Key, dict],
    source_images: set[tuple[str, str]],
    ts: dict[tuple[str, str], int],
    feats_ctx: dict[Key, AreaFeatures] | None = None,
) -> np.ndarray:
    """Feature matrix for `keys`. Neighbour features only use labels of photos in `source_images`
    (never the row's own photo)."""
    # index labelled photos per area, sorted by time
    per_area: dict[str, list[tuple[int, str, str]]] = {}
    for (cam, img, aid) in labels:
        if (cam, img) in source_images:
            per_area.setdefault(aid, []).append((ts[(cam, img)], cam, img))
    for v in per_area.values():
        v.sort()
    X = []
    for k in keys:
        cam, img, aid = k
        f = feats[k]
        o = obs[k]
        t = ts[(cam, img)]
        cand = [c for c in per_area.get(aid, []) if c[2] != img]
        prev = max((c for c in cand if c[0] < t), default=None)
        nxt = min((c for c in cand if c[0] > t), default=None)

        def nb(c):
            if c is None:
                return _neigh(f, None, None, 9.0)
            kk = (c[1], c[2], aid)
            return _neigh(f, feats.get(kk), labels.get(kk), abs(c[0] - t) / 3600)

        # most similar labelled photos of the same area (embedding kNN)
        sims = []
        for c in cand:
            kk = (c[1], c[2], aid)
            if kk in feats:
                sims.append((_cos(f.emb, feats[kk].emb), labels[kk]))
        sims.sort(key=lambda s: -s[0])
        top = sims[:4]
        if top:
            w = np.array([max(s, 0) ** 8 for s, _ in top]) + 1e-9
            dist = np.array([_onehot(l["stock_level"]) for _, l in top])
            knn_stock = list((dist * w[:, None]).sum(0) / w.sum())
            knn_comp = float(sum(wi * l["planogram_compliant"] for wi, (_, l) in zip(w, top)) / w.sum())
            knn_best = top[0][0]
        else:
            knn_stock, knn_comp, knn_best = [1 / 3] * 3, 1.0, 0.0
        fam = o.family_probs
        p_exp = fam.get(o.family, 0.0)
        ctx = []
        if feats_ctx is not None:
            fc = feats_ctx[k]

            def csim(c):
                if c is None:
                    return [0.0, 2.0]
                kk = (c[1], c[2], aid)
                o2 = feats_ctx.get(kk)
                return [_cos(fc.emb, o2.emb), _chi2(fc.hist, o2.hist)] if o2 is not None else [0.0, 2.0]

            cs = sorted(((_cos(fc.emb, feats_ctx[(c[1], c[2], aid)].emb), labels[(c[1], c[2], aid)]) for c in cand
                         if (c[1], c[2], aid) in feats_ctx), key=lambda t: -t[0])[:4]
            if cs:
                w = np.array([max(x, 0) ** 8 for x, _ in cs]) + 1e-9
                cstock = list((np.array([_onehot(l["stock_level"]) for _, l in cs]) * w[:, None]).sum(0) / w.sum())
            else:
                cstock = [1 / 3] * 3
            ctx = [*fc.scalars, *csim(prev), *csim(nxt), *cstock]
        X.append(np.array(
            [*np.log(np.clip(o.p_stock_zeroshot, 1e-4, 1)), *np.log(np.clip(o.p_stock, 1e-4, 1)), o.container_frac,
             o.p_compliant, p_exp, max(fam.values()) if fam else 0.0,
             *f.scalars, *nb(prev), *nb(nxt), *knn_stock, knn_comp, knn_best,
             float(ts[(cam, img)] % 86400) / 3600, *ctx],
            dtype=np.float32))
    return np.stack(X)


# --------------------------------------------------------------------------- model

def _models():
    from sklearn.ensemble import HistGradientBoostingClassifier

    stock = HistGradientBoostingClassifier(max_iter=250, learning_rate=0.05, max_leaf_nodes=15,
                                           l2_regularization=1.0, random_state=0)
    comp = HistGradientBoostingClassifier(max_iter=200, learning_rate=0.05, max_leaf_nodes=15,
                                          l2_regularization=1.0, random_state=0)
    return stock, comp


def _proba3(model, X) -> np.ndarray:
    p = np.zeros((len(X), 3))
    p[:, model.classes_] = model.predict_proba(X)
    return p


def _points(p_stock: np.ndarray, p_comp: np.ndarray, y_stock: np.ndarray, y_comp: np.ndarray, bias: float = 0.0, comp_th: float = 0.5, bias_full: float = 0.0):
    pts = 0
    detail = {"id_ok": 0, "id_wrong": 0, "stock_ok": 0, "below": 0, "above": 0}
    for ps, pc, ys, yc in zip(p_stock, p_comp, y_stock, y_comp):
        ps = ps.copy()
        ps[0] *= np.exp(bias)
        ps[2] *= np.exp(bias_full)
        _, val, _ = decide_stock(ps)
        pred = int(round(val * 2))
        comp = pc >= comp_th
        if comp == bool(yc):
            pts += 1; detail["id_ok"] += 1
        else:
            pts -= 2; detail["id_wrong"] += 1
        if pred == ys:
            pts += 1; detail["stock_ok"] += 1
        elif pred < ys:
            pts -= 2; detail["below"] += 1
        else:
            pts -= 3; detail["above"] += 1
    return pts, detail


def cross_validate(keys, feats, obs, labels, ts, n_splits: int = 5, log=print, feats_ctx=None):
    from sklearn.model_selection import GroupKFold

    y_stock = np.array([LEVEL_IDX[labels[k]["stock_level"]] for k in keys])
    y_comp = np.array([int(labels[k]["planogram_compliant"]) for k in keys])
    groups = np.array([f"{k[0]}/{k[1]}" for k in keys])
    oof_s = np.zeros((len(keys), 3))
    oof_c = np.zeros(len(keys))
    all_imgs = {(k[0], k[1]) for k in keys}
    for fold, (tr, te) in enumerate(GroupKFold(n_splits=n_splits).split(keys, y_stock, groups)):
        src = {(keys[i][0], keys[i][1]) for i in tr}
        Xtr = build_rows([keys[i] for i in tr], feats, obs, labels, src, ts, feats_ctx)
        Xte = build_rows([keys[i] for i in te], feats, obs, labels, src, ts, feats_ctx)
        ms, mc = _models()
        ms.fit(Xtr, y_stock[tr])
        oof_s[te] = _proba3(ms, Xte)
        if len(set(y_comp[tr])) == 2:
            mc.fit(Xtr, y_comp[tr])
            oof_c[te] = mc.predict_proba(Xte)[:, list(mc.classes_).index(1)]
        else:
            oof_c[te] = 1.0
        if log:
            log(f"  fold {fold + 1}/{n_splits} done ({len(te)} areas held out)")
    assert all_imgs
    return oof_s, oof_c, y_stock, y_comp


def tune(oof_s, oof_c, y_stock, y_comp):
    """Small grid over the decision only (two stock biases + compliance threshold). Ties keep the
    value closest to 0 so we do not overfit the folds."""
    best = (-1e9, 0.0, 0.5, 0.0)
    for bias in np.linspace(-1.0, 1.0, 11):
        for bf in np.linspace(-1.0, 1.0, 11):
            for th in (0.3, 0.4, 0.5, 0.6):
                pts, _ = _points(oof_s, oof_c, y_stock, y_comp, bias, th, bf)
                if pts > best[0] or (pts == best[0] and abs(bias) + abs(bf) < abs(best[1]) + abs(best[3])):
                    best = (pts, float(bias), th, float(bf))
    return best


CTX_SCALE = 1.3  # whole-crate crop, see extract.scaled_quad


def train(images_dir=config.IMAGES_DIR, log=print, use_ctx: bool = False) -> dict:
    """Cross-validate, tune the decision, fit on everything and save outputs/supervised.pkl."""
    from .extract import discover, extract
    from .models import LabelFreeModel
    from .planogram import load_planogram

    pg = load_planogram()
    refs = discover(images_dir, pg)
    feats = extract(refs, pg, log=log)
    feats_ctx = extract(refs, pg, log=log, scale=CTX_SCALE) if use_ctx else None
    obs = LabelFreeModel(pg, feats).run()
    labels = load_training_labels(log)
    ts = {(r.camera, r.name): r.ts for r in refs}
    keys = sorted(k for k in labels if k in feats)
    log(f"{len(keys)} labelled areas over {len({(k[0], k[1]) for k in keys})} photos")

    # baseline: label-free model on the same areas
    y_stock = np.array([LEVEL_IDX[labels[k]["stock_level"]] for k in keys])
    y_comp = np.array([int(labels[k]["planogram_compliant"]) for k in keys])
    lf_pts, lf_det = _points(np.stack([obs[k].p_stock for k in keys]), np.array([obs[k].p_compliant for k in keys]), y_stock, y_comp)

    oof_s, oof_c, _, _ = cross_validate(keys, feats, obs, labels, ts, log=log, feats_ctx=feats_ctx)
    raw_pts, raw_det = _points(oof_s, oof_c, y_stock, y_comp)
    best_pts, bias, th, bias_full = tune(oof_s, oof_c, y_stock, y_comp)
    _, best_det = _points(oof_s, oof_c, y_stock, y_comp, bias, th, bias_full)
    n = len(keys)
    per289 = lambda p: round(p / n * 289)  # noqa: E731
    report = {
        "n_areas": n,
        "label_free": {"points": lf_pts, "per_289": per289(lf_pts), **lf_det},
        "supervised_cv": {"points": raw_pts, "per_289": per289(raw_pts), **raw_det},
        "supervised_cv_tuned": {"points": best_pts, "per_289": per289(best_pts), "bias_empty": bias, "bias_full": bias_full, "comp_threshold": th, **best_det},
        "max": 2 * n,
    }
    log(json.dumps(report, indent=1))

    # per camera (tuned)
    per_cam = {}
    for i, k in enumerate(keys):
        per_cam.setdefault(k[0], []).append(i)
    report["per_camera"] = {}
    for cam, idx in sorted(per_cam.items()):
        idx = np.array(idx)
        p, d = _points(oof_s[idx], oof_c[idx], y_stock[idx], y_comp[idx], bias, th, bias_full)
        report["per_camera"][cam] = {"points": p, "max": 2 * len(idx), **d}

    # fit on everything
    src = {(k[0], k[1]) for k in keys}
    X = build_rows(keys, feats, obs, labels, src, ts, feats_ctx)
    ms, mc = _models()
    ms.fit(X, y_stock)
    mc.fit(X, y_comp)
    MODEL_PATH.parent.mkdir(parents=True, exist_ok=True)
    with MODEL_PATH.open("wb") as fh:
        pickle.dump({"stock": ms, "comp": mc, "use_ctx": feats_ctx is not None, "bias": bias, "bias_full": bias_full, "comp_th": th, "report": report}, fh)
    # a rehearsal (SENSEI_HOLDOUT) keeps its files next to its own model
    side = MODEL_PATH.parent if os.environ.get("SENSEI_HOLDOUT") else config.OUTPUTS_DIR
    (side / "supervised_report.json").write_text(json.dumps(report, indent=1))
    # out-of-fold predictions, to inspect errors in the app or a notebook
    oof = {f"{k[0]}|{k[1]}|{k[2]}": {"p_stock": oof_s[i].round(3).tolist(), "p_comp": round(float(oof_c[i]), 3),
                                    "y_stock": int(y_stock[i]), "y_comp": int(y_comp[i])} for i, k in enumerate(keys)}
    (side / "supervised_oof.json").write_text(json.dumps(oof))
    # Labels the held-out model strongly disagrees with: worth a second look in the Label tab.
    sus = []
    for i, k in enumerate(keys):
        p_lab = oof_s[i][y_stock[i]]
        p_c = oof_c[i] if y_comp[i] == 1 else 1 - oof_c[i]
        if p_lab < 0.08 or p_c < 0.1:
            sus.append((min(p_lab, p_c), {"key": "|".join(k), "labelled": LEVELS[y_stock[i]],
                                          "model": LEVELS[int(np.argmax(oof_s[i]))], "labelled_compliant": bool(y_comp[i]),
                                          "p_compliant": round(float(oof_c[i]), 3)}))
    sus.sort(key=lambda t: t[0])
    sus_dir = side if os.environ.get("SENSEI_HOLDOUT") else config.ANNOTATIONS_DIR
    (sus_dir / "review_suspects.json").write_text(json.dumps([x for _, x in sus], indent=1))
    log(f"{len(sus)} labels to double-check written to eval/review_suspects.json")
    log(f"saved {MODEL_PATH}")
    return report


def load():
    if not MODEL_PATH.exists():
        return None
    with MODEL_PATH.open("rb") as fh:
        return pickle.load(fh)


def predict(model, target_keys, feats, obs, ts, feats_ctx=None) -> dict[Key, tuple[np.ndarray, float]]:
    labels = load_training_labels(log=None)
    src = {(k[0], k[1]) for k in labels}
    X = build_rows(target_keys, feats, obs, labels, src, ts, feats_ctx if model.get("use_ctx") else None)
    ps = _proba3(model["stock"], X)
    pc = model["comp"].predict_proba(X)[:, list(model["comp"].classes_).index(1)]
    out = {}
    for k, s, c in zip(target_keys, ps, pc):
        s = s.copy()
        s[0] *= np.exp(model["bias"])
        s[2] *= np.exp(model.get("bias_full", 0.0))
        s = s / s.sum()
        # shift so that decide_compliance's 0.5 threshold equals the tuned one
        c_adj = float(np.clip(0.5 + (c - model["comp_th"]), 0, 1))
        out[k] = (s, c_adj)
    return out
