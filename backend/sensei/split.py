"""Train / test split of the labelled photos: first N per camera vs the rest."""
from __future__ import annotations

from functools import lru_cache

from . import config


@lru_cache(maxsize=1)
def _order() -> dict[str, list[str]]:
    out = {}
    if config.IMAGES_DIR.exists():
        for d in config.IMAGES_DIR.iterdir():
            if d.is_dir():
                out[d.name] = sorted(p.name for p in d.iterdir() if p.suffix.lower() in {".jpg", ".jpeg", ".png"})
    return out


def is_test(camera: str, image: str) -> bool:
    order = _order().get(camera, [])
    return image in order and order.index(image) >= config.TRAIN_PER_CAMERA


def test_images() -> dict[str, list[str]]:
    return {c: v[config.TRAIN_PER_CAMERA:] for c, v in _order().items()}


def only(labels: dict, test: bool) -> dict:
    return {c: {i: a for i, a in imgs.items() if is_test(c, i) == test} for c, imgs in labels.items()}
