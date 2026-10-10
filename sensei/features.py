"""Hand-crafted, label-free features of a rectified planogram area."""
from __future__ import annotations

import cv2
import numpy as np

H_BINS, S_BINS, V_BINS = 12, 4, 4
FEATURE_NAMES = [
    "valid_frac",
    "sat_mean",
    "val_mean",
    "dark_frac",  # black gondola shelves / shadows
    "teal_frac",  # teal / green plastic crates
    "white_frac",  # cardboard trays, white plastic
    "colour_frac",  # saturated pixels that are not crate-teal: usually produce
    "edge_density",
    "lap_var",
    "blob_density",
]


def hsv_hist(crop: np.ndarray, mask: np.ndarray) -> np.ndarray:
    hsv = cv2.cvtColor(crop, cv2.COLOR_BGR2HSV)
    h = cv2.calcHist([hsv], [0, 1, 2], mask, [H_BINS, S_BINS, V_BINS], [0, 180, 0, 256, 0, 256]).ravel()
    s = h.sum()
    return (h / s).astype(np.float32) if s > 0 else h.astype(np.float32)


def scalar_features(crop: np.ndarray, mask: np.ndarray) -> np.ndarray:
    valid = mask > 0
    n = max(int(valid.sum()), 1)
    hsv = cv2.cvtColor(crop, cv2.COLOR_BGR2HSV)
    h, s, v = (hsv[..., i].astype(np.float32) for i in range(3))
    dark = (v < 55) & valid
    teal = (h >= 70) & (h <= 105) & (s > 70) & (v > 50) & valid
    white = (s < 35) & (v > 150) & valid
    colour = (s > 90) & (v > 60) & ~teal & valid
    gray = cv2.cvtColor(crop, cv2.COLOR_BGR2GRAY)
    edges = cv2.Canny(gray, 60, 160)
    lap = cv2.Laplacian(gray, cv2.CV_32F)
    # Round produce gives many small bright/dark blobs; use a DoG response count.
    g1 = cv2.GaussianBlur(gray, (0, 0), 2)
    g2 = cv2.GaussianBlur(gray, (0, 0), 6)
    dog = cv2.absdiff(g1, g2)
    blobs = (dog > 12) & valid
    return np.array(
        [
            n / valid.size,
            s[valid].mean() / 255 if n > 1 else 0,
            v[valid].mean() / 255 if n > 1 else 0,
            dark.sum() / n,
            teal.sum() / n,
            white.sum() / n,
            colour.sum() / n,
            (edges[valid] > 0).sum() / n,
            float(lap[valid].var()) / 1000 if n > 1 else 0,
            blobs.sum() / n,
        ],
        dtype=np.float32,
    )
