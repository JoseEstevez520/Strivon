"""Image discovery and per-area feature extraction (with an on-disk cache)."""
from __future__ import annotations

import datetime as dt
import hashlib
from dataclasses import dataclass
from pathlib import Path

import cv2
import numpy as np

from . import clip_backend, config
from .features import hsv_hist, scalar_features
from .geometry import rectify
from .planogram import Planogram

IMG_EXT = {".jpg", ".jpeg", ".png"}


@dataclass(frozen=True)
class ImageRef:
    camera: str
    name: str
    path: Path

    @property
    def ts(self) -> int | None:
        try:
            return int(Path(self.name).stem)
        except ValueError:
            return None

    @property
    def local_time(self) -> str:
        if self.ts is None:
            return ""
        t = dt.datetime.fromtimestamp(self.ts, dt.timezone.utc) + dt.timedelta(hours=config.TZ_OFFSET_HOURS)
        return t.strftime("%H:%M")


def discover(images_dir: Path | str, planogram: Planogram, camera: str | None = None) -> list[ImageRef]:
    """Find images laid out as <dir>/<camera>/<timestamp>.jpg (or flat with --camera)."""
    images_dir = Path(images_dir)
    refs: list[ImageRef] = []
    if camera:
        for p in sorted(images_dir.iterdir()):
            if p.suffix.lower() in IMG_EXT:
                refs.append(ImageRef(camera, p.name, p))
        return refs
    for cam_dir in sorted(p for p in images_dir.iterdir() if p.is_dir()):
        if cam_dir.name not in planogram.cameras:
            continue
        for p in sorted(cam_dir.iterdir()):
            if p.suffix.lower() in IMG_EXT and not p.name.startswith("._"):
                refs.append(ImageRef(cam_dir.name, p.name, p))
    return refs


@dataclass
class AreaFeatures:
    scalars: np.ndarray  # see features.FEATURE_NAMES
    hist: np.ndarray
    emb: np.ndarray | None  # CLIP embedding (L2 normalised) or None


def _cache_path(ref: ImageRef, use_clip: bool) -> Path:
    st = ref.path.stat()
    key = f"{ref.path.resolve()}|{st.st_size}|{int(st.st_mtime)}|{config.CROP_SIZE}|{clip_backend.MODEL if use_clip else 'noclip'}|v1"
    h = hashlib.sha1(key.encode()).hexdigest()[:16]
    return config.CACHE_DIR / f"{ref.camera}_{Path(ref.name).stem}_{h}.npz"


def crops_for(ref: ImageRef, planogram: Planogram) -> tuple[list[str], list[np.ndarray], list[np.ndarray]]:
    img = cv2.imread(str(ref.path))
    if img is None:
        raise IOError(f"cannot read {ref.path}")
    if img.shape[1::-1] != config.IMAGE_SIZE:
        img = cv2.resize(img, config.IMAGE_SIZE)
    ids, crops, masks = [], [], []
    for a in planogram.cameras[ref.camera]:
        c, m = rectify(img, a.quad)
        ids.append(a.area_id)
        crops.append(c)
        masks.append(m)
    return ids, crops, masks


def extract(refs: list[ImageRef], planogram: Planogram, use_clip: bool | None = None, log=print) -> dict[tuple[str, str, str], AreaFeatures]:
    if use_clip is None:
        use_clip = clip_backend.available()
    config.CACHE_DIR.mkdir(parents=True, exist_ok=True)
    out: dict[tuple[str, str, str], AreaFeatures] = {}
    for i, ref in enumerate(refs):
        cp = _cache_path(ref, use_clip)
        if cp.exists():
            z = np.load(cp, allow_pickle=False)
            ids = [str(x) for x in z["ids"]]
            embs = z["emb"] if use_clip else None
            for j, aid in enumerate(ids):
                out[(ref.camera, ref.name, aid)] = AreaFeatures(z["scalars"][j], z["hist"][j], embs[j] if embs is not None else None)
            continue
        ids, crops, masks = crops_for(ref, planogram)
        scal = np.stack([scalar_features(c, m) for c, m in zip(crops, masks)])
        hist = np.stack([hsv_hist(c, m) for c, m in zip(crops, masks)])
        emb = clip_backend.embed_images(crops) if use_clip else np.zeros((len(ids), 0), np.float32)
        np.savez_compressed(cp, ids=np.array(ids), scalars=scal, hist=hist, emb=emb)
        for j, aid in enumerate(ids):
            out[(ref.camera, ref.name, aid)] = AreaFeatures(scal[j], hist[j], emb[j] if use_clip else None)
        if log and (i % 10 == 0 or i == len(refs) - 1):
            log(f"  features {i + 1}/{len(refs)}  ({ref.camera}/{ref.name})")
    return out
