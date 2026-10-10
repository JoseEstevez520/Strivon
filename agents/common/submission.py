"""The annotations.json / submission format: {cam: {fname: {area_id: entry}}} with

    entry = {"planogram_compliant": bool, "stock_level": "empty"|"half"|"full", "stock_value": 0|0.5|1}

Scoring (OfficialRules.pdf): compliant +1 / -2; stock +1, below truth -2, above truth -3;
an area missing from the output costs -2 and -3 (= -5), so always validate before submitting.
"""
import json
import re
from pathlib import Path

from .data import load_planogram
from .paths import PLANOGRAM_PATH

LEVELS = {"empty": 0, "half": 0.5, "full": 1}
VALUE_TO_LEVEL = {0: "empty", 0.5: "half", 1: "full"}


def snap(value):
    """Nearest valid stock value (0, 0.5 or 1). Accepts the words too."""
    if isinstance(value, str):
        return LEVELS[value]
    return min(LEVELS.values(), key=lambda v: abs(v - float(value)))


def stock_points(pred, truth):
    """Official points for one stock answer: +1 right, -2 below the truth, -3 above it."""
    return 1 if pred == truth else (-2 if pred < truth else -3)


def best_stock(probs):
    """Stock value with the best expected points, given probabilities of each true level
    ({0: p, 0.5: p, 1: p}; word keys work too). Uncertainty pushes the answer down: {0.5: .45, 1: .55}
    -> 0.5 (full needs > 4/7 confidence against half), and {0: .3, 0.5: .3, 1: .4} -> 0."""
    p = {snap(k): float(v) for k, v in probs.items()}
    return max(LEVELS.values(), key=lambda pred: sum(pv * stock_points(pred, t) for t, pv in p.items()))


def entry(compliant, stock_value):
    v = snap(stock_value)
    return {"planogram_compliant": bool(compliant), "stock_level": VALUE_TO_LEVEL[v], "stock_value": v}


def put(sub, cam, fname, area_id, compliant, stock_value):
    """Set one area's prediction in a submission dict (created on the fly)."""
    sub.setdefault(str(cam), {}).setdefault(fname, {})[area_id] = entry(compliant, stock_value)


def write(sub, path):
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        json.dump(sub, f, indent=1)


def read(path):
    with open(path, encoding="utf-8") as f:
        return json.load(f)


def expected_areas(images, planogram_path=PLANOGRAM_PATH):
    """{(cam, fname): [area_id, ...]} that a complete output for `images` (ImageRecs) must contain."""
    P = load_planogram(planogram_path)
    return {(r.cam, r.fname): [a["area_id"] for a in P[r.cam]] for r in images}


def fill_missing(sub, images, compliant=True, stock_value=1, planogram_path=PLANOGRAM_PATH):
    """Add a default entry for every expected area that is missing. Returns how many were added."""
    n = 0
    for (cam, fname), area_ids in expected_areas(images, planogram_path).items():
        got = sub.setdefault(cam, {}).setdefault(fname, {})
        for a in area_ids:
            if a not in got:
                got[a] = entry(compliant, stock_value)
                n += 1
    return n


def validate(sub, images=None, planogram_path=PLANOGRAM_PATH):
    """(errors, warnings) for a submission dict. With `images` (ImageRecs) it also checks that
    every planogram area of every image is present."""
    P = load_planogram(planogram_path)
    errors, warnings = [], []
    if not isinstance(sub, dict):
        return ["top level must be a dict {cam: {fname: {area_id: entry}}}"], warnings
    for cam, imgs in sub.items():
        if cam not in P:
            errors.append(f"unknown camera id {cam!r}")
            continue
        own = {a["area_id"] for a in P[cam]}
        for fname, areas in imgs.items():
            where = f"{cam}/{fname}"
            if not re.fullmatch(r"\d{10}\.jpg", fname):
                warnings.append(f"{where}: file name is not '<unix_ts>.jpg' - must match the image name exactly")
            for area_id, e in areas.items():
                if area_id not in own:
                    errors.append(f"{where}: {area_id} is not a planogram area of camera {cam}")
                if not isinstance(e, dict):
                    errors.append(f"{where}/{area_id}: entry must be a dict")
                    continue
                if not isinstance(e.get("planogram_compliant"), bool):
                    errors.append(f"{where}/{area_id}: planogram_compliant must be true/false")
                lvl, val = e.get("stock_level"), e.get("stock_value")
                if lvl not in LEVELS:
                    errors.append(f"{where}/{area_id}: stock_level must be empty/half/full, got {lvl!r}")
                if isinstance(val, bool) or not isinstance(val, (int, float)) or val not in (0, 0.5, 1):
                    errors.append(f"{where}/{area_id}: stock_value must be 0/0.5/1, got {val!r}")
                elif lvl in LEVELS and LEVELS[lvl] != val:
                    errors.append(f"{where}/{area_id}: stock_level {lvl!r} disagrees with stock_value {val}")
    if images is not None:
        exp = expected_areas(images, planogram_path)
        for (cam, fname), area_ids in exp.items():
            got = sub.get(cam, {}).get(fname)
            if got is None:
                errors.append(f"missing image {cam}/{fname} ({len(area_ids)} areas, {-5 * len(area_ids)} pts)")
                continue
            miss = [a for a in area_ids if a not in got]
            if miss:
                errors.append(f"{cam}/{fname}: missing {len(miss)} areas ({-5 * len(miss)} pts): {miss}")
        extra = [f"{c}/{f}" for c, imgs in sub.items() for f in imgs if (c, f) not in exp]
        if extra:
            warnings.append(f"{len(extra)} images in the output are not in the image folder, e.g. {extra[:3]}")
    return errors, warnings
