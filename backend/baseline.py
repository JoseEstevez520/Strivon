"""Label-free baseline: colour-based stock level per area + 'always compliant'.

For every area, the share of colourful pixels (produce) in each crop is measured across the
whole day, then rescaled between that area's emptiest and fullest observations, so each
gondola is calibrated against itself. Thresholds lean towards LOW stock because
overestimating costs -3 and underestimating -2.

Usage: python backend/baseline.py [predictions.json]
"""
import json
import sys
from collections import defaultdict
from pathlib import Path

import cv2
import numpy as np

from crops import IMAGES, ROOT, load_planogram, warp_area

LEVELS = {0.0: "empty", 0.5: "half", 1.0: "full"}
EMPTY_BELOW, HALF_BELOW = 0.25, 0.70  # thresholds on the calibrated fill, tuned on labels later


def colour_share(crop):
    hsv = cv2.cvtColor(crop, cv2.COLOR_BGR2HSV)
    inner = hsv[8:-8, 12:-12]  # ignore the polygon border, which catches shelf edges
    return float(((inner[..., 1] > 70) & (inner[..., 2] > 60)).mean())


def is_covered(img):
    """Curtain over the gondola: the whole frame is low-saturation and low-texture grey."""
    hsv = cv2.cvtColor(img, cv2.COLOR_BGR2HSV)
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    right = gray[:, gray.shape[1] // 2:]
    return hsv[..., 1].mean() < 25 and right.std() < 25


def to_level(fill):
    return 0.0 if fill < EMPTY_BELOW else (0.5 if fill < HALF_BELOW else 1.0)


def predict(cams):
    out = {}
    for cam, info in cams.items():
        files = sorted((IMAGES / cam).glob("*.jpg"))
        raw = defaultdict(dict)
        covered = {}
        for f in files:
            img = cv2.imread(str(f))
            covered[f.name] = is_covered(img)
            for a in info["products"]:
                raw[a["area_id"]][f.name] = colour_share(warp_area(img, a))
        out[cam] = {}
        for f in files:
            res = {}
            for a in info["products"]:
                aid = a["area_id"]
                vals = [v for n, v in raw[aid].items() if not covered[n]] or [0.0]
                lo, hi = min(vals), np.percentile(vals, 90)
                fill = 0.0 if covered[f.name] else (raw[aid][f.name] - lo) / max(hi - lo, 0.05)
                level = to_level(min(max(fill, 0.0), 1.0))
                res[aid] = {"planogram_compliant": True, "stock_level": LEVELS[level],
                            "stock_value": level, "fill_raw": round(float(fill), 3)}
            out[cam][f.name] = res
    return out


if __name__ == "__main__":
    dest = Path(sys.argv[1]) if len(sys.argv) > 1 else ROOT / "outputs" / "predictions.json"
    dest.parent.mkdir(parents=True, exist_ok=True)
    preds = predict(load_planogram())
    dest.write_text(json.dumps(preds, indent=1), encoding="utf-8")
    n = sum(len(v) for c in preds.values() for v in c.values())
    print("wrote", dest, n, "area predictions")
