"""Is a person (shopper, staff) in front of an area?

None of our 181 photos shows someone in front of the produce, so the supervised model never
learned what that looks like. We run a COCO person detector on the full frame; an area counts as
occluded when a detected person covers a good part of it. For those areas the pipeline falls back
on what the same area showed in the nearest labelled photos (stock changes slowly over the day).

CLIP prompts on the crop were tried first and rejected: bananas and ginger fire as "arms" and "hands".
"""
from __future__ import annotations

import os
from functools import lru_cache

import cv2
import numpy as np

SCORE_MIN = float(os.environ.get("SENSEI_PERSON_SCORE", 0.85))  # 0.77-0.81 fired on sweet potatoes
COVER_MIN = float(os.environ.get("SENSEI_PERSON_COVER", 0.25))


@lru_cache(maxsize=1)
def _detector():
    import torch  # noqa: F401
    from torchvision.models.detection import (FasterRCNN_MobileNet_V3_Large_FPN_Weights,
                                              fasterrcnn_mobilenet_v3_large_fpn)

    m = fasterrcnn_mobilenet_v3_large_fpn(weights=FasterRCNN_MobileNet_V3_Large_FPN_Weights.DEFAULT)
    m.eval()
    return m


def person_boxes(path) -> list[tuple[float, float, float, float, float]]:
    import torch

    img = cv2.cvtColor(cv2.imread(str(path)), cv2.COLOR_BGR2RGB)
    t = torch.from_numpy(img).permute(2, 0, 1).float() / 255
    with torch.no_grad():
        out = _detector()([t])[0]
    boxes = []
    for b, label, s in zip(out["boxes"].numpy(), out["labels"].numpy(), out["scores"].numpy()):
        if label == 1 and s >= SCORE_MIN:  # COCO class 1 = person
            boxes.append((*map(float, b), float(s)))
    return boxes


def covered_fraction(quad: np.ndarray, boxes, size=(1280, 720)) -> float:
    """Share of the area polygon (inside the image) covered by person boxes."""
    w, h = size
    area_mask = np.zeros((h, w), np.uint8)
    cv2.fillPoly(area_mask, [quad.astype(np.int32)], 1)
    n = int(area_mask.sum())
    if n == 0 or not boxes:
        return 0.0
    pm = np.zeros((h, w), np.uint8)
    for x0, y0, x1, y1, _ in boxes:
        pm[int(max(0, y0)):int(min(h, y1)), int(max(0, x0)):int(min(w, x1))] = 1
    return float((area_mask & pm).sum() / n)
