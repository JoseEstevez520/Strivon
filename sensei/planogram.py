from __future__ import annotations

import json
from dataclasses import dataclass, field
from functools import lru_cache
from pathlib import Path

import numpy as np

from . import config
from .catalog import ProductInfo, product_info

CORNERS = ("top_left", "top_right", "bottom_right", "bottom_left")


@dataclass
class Area:
    area_id: str
    camera: str
    product_id: str
    product_name: str
    quad: np.ndarray  # (4,2) float32 in TL, TR, BR, BL order
    info: ProductInfo = field(repr=False)

    @property
    def index(self) -> int:
        return int(self.area_id.split("_")[-1])

    def visible_fraction(self, w: int = config.IMAGE_SIZE[0], h: int = config.IMAGE_SIZE[1]) -> float:
        """Share of the quadrilateral that lies inside the image (negative coords = cut off)."""
        from .geometry import polygon_area, clip_polygon

        full = polygon_area(self.quad)
        return float(polygon_area(clip_polygon(self.quad, w, h)) / full) if full > 0 else 0.0

    def to_json(self) -> dict:
        return {
            "area_id": self.area_id,
            "camera": self.camera,
            "index": self.index,
            "product_id": self.product_id,
            "product_name": self.product_name,
            "short_name": self.info.short_name,
            "family": self.info.family,
            "description": self.info.description,
            "packaged": self.info.packaged,
            "quad": self.quad.round(1).tolist(),
            "visible_fraction": round(self.visible_fraction(), 3),
        }


@dataclass
class Planogram:
    cameras: dict[str, list[Area]]

    @property
    def areas(self) -> list[Area]:
        return [a for areas in self.cameras.values() for a in areas]

    def area(self, area_id: str) -> Area:
        cam = area_id.split("_")[0]
        for a in self.cameras[cam]:
            if a.area_id == area_id:
                return a
        raise KeyError(area_id)

    def families(self, camera: str | None = None) -> list[str]:
        areas = self.cameras[camera] if camera else self.areas
        return sorted({a.info.family for a in areas})


def load_planogram(path: Path | str = config.PLANOGRAM_PATH) -> Planogram:
    return _load(str(path))


@lru_cache(maxsize=4)
def _load(path: str) -> Planogram:
    raw = json.loads(Path(path).read_text(encoding="utf-8"))
    cams = raw[config.SECTION]["cameras"]
    out: dict[str, list[Area]] = {}
    for cam, d in cams.items():
        areas = []
        for p in d["products"]:
            c = p["image_coordinates"]
            quad = np.array([c[k] for k in CORNERS], dtype=np.float32)
            areas.append(
                Area(p["area_id"], cam, str(p["product_id"]), p["product_name"], quad, product_info(p["product_name"]))
            )
        out[cam] = sorted(areas, key=lambda a: a.index)
    return Planogram(out)
