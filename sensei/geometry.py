"""Perspective rectification of planogram quadrilaterals."""
from __future__ import annotations

import cv2
import numpy as np

from . import config


def polygon_area(poly: np.ndarray) -> float:
    if len(poly) < 3:
        return 0.0
    x, y = poly[:, 0], poly[:, 1]
    return float(0.5 * abs(np.dot(x, np.roll(y, 1)) - np.dot(y, np.roll(x, 1))))


def clip_polygon(poly: np.ndarray, w: int, h: int) -> np.ndarray:
    """Sutherland–Hodgman clip of a polygon to the image rectangle."""
    def clip(pts, inside, intersect):
        out = []
        for i in range(len(pts)):
            cur, prev = pts[i], pts[i - 1]
            if inside(cur):
                if not inside(prev):
                    out.append(intersect(prev, cur))
                out.append(cur)
            elif inside(prev):
                out.append(intersect(prev, cur))
        return out

    def ix(x0):
        return lambda p, q: (x0, p[1] + (q[1] - p[1]) * (x0 - p[0]) / (q[0] - p[0]))

    def iy(y0):
        return lambda p, q: (p[0] + (q[0] - p[0]) * (y0 - p[1]) / (q[1] - p[1]), y0)

    pts = [tuple(p) for p in poly.tolist()]
    for inside, inter in (
        (lambda p: p[0] >= 0, ix(0)),
        (lambda p: p[0] <= w, ix(w)),
        (lambda p: p[1] >= 0, iy(0)),
        (lambda p: p[1] <= h, iy(h)),
    ):
        if not pts:
            break
        pts = clip(pts, inside, inter)
    return np.array(pts, dtype=np.float32).reshape(-1, 2)


def rectify(image: np.ndarray, quad: np.ndarray, size: tuple[int, int] = config.CROP_SIZE) -> tuple[np.ndarray, np.ndarray]:
    """Warp the quadrilateral to a (w, h) rectangle.

    Returns the crop (BGR) and a validity mask (uint8, 255 where the pixel came
    from inside the image) so partially visible areas are handled correctly.
    """
    w, h = size
    dst = np.float32([[0, 0], [w, 0], [w, h], [0, h]])
    m = cv2.getPerspectiveTransform(quad.astype(np.float32), dst)
    crop = cv2.warpPerspective(image, m, (w, h), flags=cv2.INTER_AREA, borderMode=cv2.BORDER_CONSTANT)
    ones = np.full(image.shape[:2], 255, np.uint8)
    mask = cv2.warpPerspective(ones, m, (w, h), flags=cv2.INTER_NEAREST, borderMode=cv2.BORDER_CONSTANT)
    return crop, mask
