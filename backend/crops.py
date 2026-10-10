"""Warp every planogram area of every camera image into a fixed-size rectangle.

Usage: python backend/crops.py [out_dir]
Writes <out_dir>/<camera>/<area_id>/<image>.jpg and a contact sheet per camera/image
with the area polygons drawn, to check the planogram alignment by eye.
"""
import json
import sys
from pathlib import Path

import cv2
import numpy as np

ROOT = Path(__file__).resolve().parent.parent
PLANOGRAM = ROOT / "data" / "planogram.json"
IMAGES = ROOT / "data" / "images"
CROP_W, CROP_H = 256, 160


def load_planogram():
    with open(PLANOGRAM, encoding="utf-8") as f:
        return json.load(f)["Frutas e Legumes"]["cameras"]


def corners(area):
    c = area["image_coordinates"]
    return np.float32([c["top_left"], c["top_right"], c["bottom_right"], c["bottom_left"]])


def warp_area(img, area, w=CROP_W, h=CROP_H):
    """Perspective-warp an area to a w x h rectangle. Parts outside the image become black."""
    dst = np.float32([[0, 0], [w, 0], [w, h], [0, h]])
    m = cv2.getPerspectiveTransform(corners(area), dst)
    return cv2.warpPerspective(img, m, (w, h), borderMode=cv2.BORDER_CONSTANT, borderValue=(0, 0, 0))


def visible_fraction(img, area):
    """Fraction of the area polygon that lies inside the image."""
    h, w = img.shape[:2]
    poly = corners(area)
    full = np.zeros((h * 3, w * 3), np.uint8)
    cv2.fillPoly(full, [(poly + [w, h]).astype(np.int32)], 255)
    tot = full.sum()
    return float(full[h:2 * h, w:2 * w].sum() / tot) if tot else 0.0


def draw_overlay(img, areas):
    out = img.copy()
    for a in areas:
        pts = corners(a).astype(np.int32)
        cv2.polylines(out, [pts], True, (0, 255, 0), 2)
        cv2.putText(out, a["area_id"].split("_")[1], tuple(pts[0] + [4, 18]),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 255, 255), 2)
    return out


def main(out_dir):
    out_dir = Path(out_dir)
    cams = load_planogram()
    for cam, info in cams.items():
        files = sorted((IMAGES / cam).glob("*.jpg"))
        for k, f in enumerate(files):
            img = cv2.imread(str(f))
            for a in info["products"]:
                d = out_dir / cam / a["area_id"]
                d.mkdir(parents=True, exist_ok=True)
                cv2.imwrite(str(d / f.name), warp_area(img, a))
            if k == 0:
                (out_dir / "overlays").mkdir(parents=True, exist_ok=True)
                cv2.imwrite(str(out_dir / "overlays" / f"{cam}.jpg"), draw_overlay(img, info["products"]))
        print(cam, len(files), "images", len(info["products"]), "areas")


if __name__ == "__main__":
    main(sys.argv[1] if len(sys.argv) > 1 else ROOT / "outputs" / "crops")
