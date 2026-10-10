"""Area geometry and crops.

`img` may be a PIL image or an RGB numpy array (H, W, 3); crop functions return the same type.
Corners can be negative (area partly outside the frame): rectify() fills that part with `border`
and rectify_mask() tells you which patch pixels are real.

Crate crop: stock is judged on the whole crate an area stands for, and many polygons cut off the
back rows. Every function below takes expand_depth / expand_front (fractions of the polygon's
side length): the top (back) edge moves away from the bottom edge along both sides, and the bottom
(front) edge the other way. Sides stay on their own lines, so neighbouring slots never swallow each
other, and a moved corner stops at the image border (clip=True).
expand_depth='auto' (and/or expand_front='auto') reads the shared per-area values in
common/crate_expand.json: only areas whose polygon really cuts the crate are listed, all others are 0.
"""
import json
from functools import lru_cache
from pathlib import Path

import cv2
import numpy as np
from PIL import Image

from .data import CORNERS, IMAGE_SIZE

CRATE_EXPAND_PATH = Path(__file__).with_name("crate_expand.json")


@lru_cache(maxsize=1)
def crate_expand_map():
    """{area_id: (depth, front)} from common/crate_expand.json. A value is a number (depth) or
    {"depth": x, "front": y}; keys starting with "_" are comments; missing areas are (0, 0)."""
    try:
        raw = json.loads(CRATE_EXPAND_PATH.read_text(encoding="utf-8"))
    except FileNotFoundError:
        return {}
    out = {}
    for k, v in raw.items():
        if k.startswith("_"):
            continue
        out[k] = (float(v), 0.0) if isinstance(v, (int, float)) else (float(v.get("depth", 0)), float(v.get("front", 0)))
    return out


def _max_inside(p, v, t, img_size):
    """Largest s in [0, t] with p + s*v inside the image (0 if p itself is already outside)."""
    w, h = img_size
    if not (0 <= p[0] <= w and 0 <= p[1] <= h):
        return 0.0
    s = t
    for k, lim in ((0, w), (1, h)):
        if v[k] > 0:
            s = min(s, (lim - p[k]) / v[k])
        elif v[k] < 0:
            s = min(s, -p[k] / v[k])
    return max(0.0, float(s))


def quad(area, expand_depth=0.0, expand_front=0.0, img_size=IMAGE_SIZE, clip=True):
    """(4, 2) float32 corners TL, TR, BR, BL as (x, y) pixels, optionally grown to the crate."""
    if expand_depth == "auto" or expand_front == "auto":
        depth, front = crate_expand_map().get(area["area_id"], (0.0, 0.0))
        expand_depth = depth if expand_depth == "auto" else expand_depth
        expand_front = front if expand_front == "auto" else expand_front
    c = area["image_coordinates"]
    q = np.array([c[k] for k in CORNERS], dtype=np.float32)
    if not (expand_depth or expand_front):
        return q
    tl, tr, br, bl = q
    left, right = tl - bl, tr - br  # bottom -> top along each side

    def move(p, v, t):
        return p + (_max_inside(p, v, t, img_size) if clip else t) * v

    return np.array([move(tl, left, expand_depth), move(tr, right, expand_depth),
                     move(br, -right, expand_front), move(bl, -left, expand_front)], dtype=np.float32)


def _size(img):
    return img.size if isinstance(img, Image.Image) else (img.shape[1], img.shape[0])


def bbox(area, img_size=IMAGE_SIZE, pad=0, **grow):
    """Axis-aligned (x0, y0, x1, y1) around the area, padded and clipped to the image."""
    q = quad(area, img_size=img_size, **grow)
    x0, y0 = np.floor(q.min(axis=0)).astype(int) - pad
    x1, y1 = np.ceil(q.max(axis=0)).astype(int) + pad
    w, h = img_size
    return max(0, int(x0)), max(0, int(y0)), min(w, int(x1)), min(h, int(y1))


def bbox_crop(img, area, pad=0, **grow):
    """Unwarped rectangular crop around the area (keeps context; good for showing to humans)."""
    x0, y0, x1, y1 = bbox(area, _size(img), pad, **grow)
    if isinstance(img, Image.Image):
        return img.crop((x0, y0, x1, y1))
    return img[y0:y1, x0:x1]


def polygon_mask(area, img_size=IMAGE_SIZE, **grow):
    """bool (H, W) mask of the area polygon on the full image."""
    w, h = img_size
    m = np.zeros((h, w), np.uint8)
    cv2.fillPoly(m, [np.round(quad(area, img_size=img_size, **grow)).astype(np.int32)], 1)
    return m.astype(bool)


def visible_fraction(area, img_size=IMAGE_SIZE, **grow):
    """Share of the area polygon inside the image (1.0 for most areas)."""
    q = quad(area, img_size=img_size, **grow)
    full = abs(cv2.contourArea(q))
    w, h = img_size
    frame = np.array([[0, 0], [w, 0], [w, h], [0, h]], np.float32)
    inside, _ = cv2.intersectConvexConvex(q, frame)
    return float(inside / full) if full > 0 else 0.0


def native_size(area, img_size=IMAGE_SIZE, **grow):
    """(w, h) that keeps the area's on-image resolution when rectified."""
    tl, tr, br, bl = quad(area, img_size=img_size, **grow)
    w = max(np.linalg.norm(tr - tl), np.linalg.norm(br - bl))
    h = max(np.linalg.norm(bl - tl), np.linalg.norm(br - tr))
    return max(1, int(round(w))), max(1, int(round(h)))


def _homography(area, size, img_size, grow):
    w, h = size
    dst = np.array([[0, 0], [w, 0], [w, h], [0, h]], np.float32)
    return cv2.getPerspectiveTransform(quad(area, img_size=img_size, **grow), dst)


def rectify(img, area, size=(224, 224), border=0, **grow):
    """Perspective-warp the area to a fronto-parallel (w, h) patch, TL corner at top-left.
    size=None keeps the native resolution. grow: expand_depth=, expand_front=, clip= (see top)."""
    was_pil = isinstance(img, Image.Image)
    arr = np.asarray(img.convert("RGB")) if was_pil else img
    img_size = _size(img)
    size = native_size(area, img_size, **grow) if size is None else (int(size[0]), int(size[1]))
    out = cv2.warpPerspective(arr, _homography(area, size, img_size, grow), size, flags=cv2.INTER_LINEAR,
                              borderMode=cv2.BORDER_CONSTANT, borderValue=(border, border, border))
    return Image.fromarray(out) if was_pil else out


def rectify_mask(area, size=(224, 224), img_size=IMAGE_SIZE, **grow):
    """bool (h, w): True where the rectified patch holds real pixels, False where it fell off-frame."""
    w, h = img_size
    size = native_size(area, img_size, **grow) if size is None else (int(size[0]), int(size[1]))
    ones = np.full((h, w), 255, np.uint8)
    m = cv2.warpPerspective(ones, _homography(area, size, img_size, grow), size, flags=cv2.INTER_NEAREST,
                            borderMode=cv2.BORDER_CONSTANT, borderValue=0)
    return m > 0
