"""Optional calibration on team labels.

The label-free model works out of the box. Once the team has annotated some
train/test areas (with the app's "Anotar" tab), this fits a tiny logistic
model on top of the label-free features, cross-validates it with the official
scoring rules and saves it to outputs/calibration.json. The pipeline then uses
it automatically. Delete that file to go back to the pure label-free model.
"""
from __future__ import annotations

import json
from pathlib import Path

import numpy as np

from . import config
from .decision import decide_compliance, decide_stock

CAL_PATH = config.OUTPUTS_DIR / "calibration.json"
LEVEL_INDEX = {"empty": 0, "half": 1, "full": 2}


def stock_vector(o, f) -> np.ndarray:
    z = np.log(np.clip(o.p_stock_zeroshot, 1e-4, 1))
    return np.concatenate([z, [o.container_frac], np.log(np.clip(o.p_stock, 1e-4, 1)), f.scalars]).astype(float)


def comp_vector(o) -> np.ndarray:
    pc = np.clip(o.p_compliant, 1e-4, 1 - 1e-4)
    return np.array([np.log(pc / (1 - pc)), o.p_stock[0]])


def load(path: Path = CAL_PATH) -> dict | None:
    if not path.exists():
        return None
    return json.loads(path.read_text())


def _softmax(x):
    x = x - x.max()
    e = np.exp(x)
    return e / e.sum()


def apply(cal: dict, o, f, p_stock, p_comp):
    if "stock" in cal:
        s = cal["stock"]
        x = (stock_vector(o, f) - np.array(s["mean"])) / np.array(s["std"])
        p_stock = _softmax(np.array(s["coef"]) @ x + np.array(s["intercept"]))
    if "compliance" in cal:
        c = cal["compliance"]
        z = float(np.array(c["coef"]) @ comp_vector(o) + c["intercept"])
        p_comp = 1 / (1 + np.exp(-z))
    return p_stock, p_comp


def load_annotations(paths: list[Path]) -> dict:
    merged: dict = {}
    for p in paths:
        d = json.loads(Path(p).read_text(encoding="utf-8"))
        for cam, imgs in d.items():
            for img, areas in imgs.items():
                merged.setdefault(cam, {}).setdefault(img, {}).update(areas)
    return merged


def fit(annotation_paths: list[Path], images_dir: Path = config.IMAGES_DIR, log=print, save: bool = True) -> dict:
    from sklearn.linear_model import LogisticRegression
    from sklearn.model_selection import StratifiedKFold

    from .extract import discover, extract
    from .models import LabelFreeModel
    from .planogram import load_planogram
    from .scoring import score

    from .split import only

    pg = load_planogram()
    # Only the train photos: the last photos of each camera stay held out to check the model.
    ann = only(load_annotations(annotation_paths), test=False)
    refs = discover(images_dir, pg)
    feats = extract(refs, pg, log=log)
    obs = LabelFreeModel(pg, feats).run()
    keys, ys, yc = [], [], []
    for cam, imgs in ann.items():
        for img, areas in imgs.items():
            for aid, gt in areas.items():
                k = (cam, img, aid)
                if k in obs:
                    keys.append(k)
                    ys.append(LEVEL_INDEX[gt["stock_level"]])
                    yc.append(int(bool(gt["planogram_compliant"])))
    n = len(keys)
    log(f"{n} annotated areas found ({sum(1 for c in yc if not c)} non-compliant)")
    if n < 20:
        raise SystemExit("need at least ~20 annotated areas to calibrate")
    ys, yc = np.array(ys), np.array(yc)
    Xs = np.stack([stock_vector(obs[k], feats[k]) for k in keys])
    Xc = np.stack([comp_vector(obs[k]) for k in keys])
    mean, std = Xs.mean(0), Xs.std(0) + 1e-6

    def to_sub(pairs):
        sub = {}
        for k, (ps, pc) in pairs.items():
            lvl, val, _ = decide_stock(ps)
            comp, _ = decide_compliance(pc)
            sub.setdefault(k[0], {}).setdefault(k[1], {})[k[2]] = {
                "planogram_compliant": comp, "stock_level": lvl, "stock_value": val}
        return sub

    gt_sub = {}
    for k, s_, c_ in zip(keys, ys, yc):
        gt_sub.setdefault(k[0], {}).setdefault(k[1], {})[k[2]] = {
            "planogram_compliant": bool(c_), "stock_level": config.LEVEL_NAMES[s_], "stock_value": [0, .5, 1][s_]}
    base = score(to_sub({k: (obs[k].p_stock, obs[k].p_compliant) for k in keys}), gt_sub)
    log("label-free model on annotated areas:\n" + str(base))

    # Cross-validated estimate of the calibrated model (grouped by camera would be stricter;
    # with few labels we use stratified folds).
    n_splits = max(2, min(5, int(np.bincount(ys).min()) if len(set(ys)) == 3 else 2))
    cv_pairs = {}
    skf = StratifiedKFold(n_splits=n_splits, shuffle=True, random_state=0)
    for tr, te in skf.split(Xs, ys):
        ms = LogisticRegression(C=0.5, max_iter=2000).fit((Xs[tr] - mean) / std, ys[tr])
        ps = np.zeros((len(te), 3))
        ps[:, ms.classes_] = ms.predict_proba((Xs[te] - mean) / std)
        pc = np.array([obs[keys[i]].p_compliant for i in te])
        if len(set(yc[tr])) == 2 and (yc[tr] == 0).sum() >= 3:
            mc = LogisticRegression(C=0.5, max_iter=2000).fit(Xc[tr], yc[tr])
            pc = mc.predict_proba(Xc[te])[:, 1]
        for j, i in enumerate(te):
            cv_pairs[keys[i]] = (ps[j] + 1e-6, pc[j])
    cv = score(to_sub(cv_pairs), gt_sub)
    log(f"calibrated model, {n_splits}-fold cross-validation:\n" + str(cv))

    ms = LogisticRegression(C=0.5, max_iter=2000).fit((Xs - mean) / std, ys)
    coef = np.zeros((3, Xs.shape[1]))
    inter = np.full(3, -20.0)
    coef[ms.classes_] = ms.coef_ if len(ms.classes_) > 2 else np.vstack([-ms.coef_[0] / 2, ms.coef_[0] / 2])
    inter[ms.classes_] = ms.intercept_ if len(ms.classes_) > 2 else [-ms.intercept_[0] / 2, ms.intercept_[0] / 2]
    cal = {
        "name": f"{n} annotated areas",
        "n": n,
        "cv_score": cv.total,
        "cv_max": cv.maximum,
        "label_free_score": base.total,
        "stock": {"mean": mean.tolist(), "std": std.tolist(), "coef": coef.tolist(), "intercept": inter.tolist()},
    }
    if len(set(yc)) == 2 and (yc == 0).sum() >= 3:
        mc = LogisticRegression(C=0.5, max_iter=2000).fit(Xc, yc)
        cal["compliance"] = {"coef": mc.coef_[0].tolist(), "intercept": float(mc.intercept_[0])}
    if save:
        if cv.total >= base.total:
            CAL_PATH.parent.mkdir(parents=True, exist_ok=True)
            CAL_PATH.write_text(json.dumps(cal, indent=1))
            log(f"saved {CAL_PATH} (CV {cv.total} >= label-free {base.total})")
        else:
            log(f"NOT saved: calibrated CV score {cv.total} < label-free {base.total}")
    return cal
