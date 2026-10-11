"""Planogram loading and image listing.

An `area` is always the raw planogram.json product entry (area_id, product_id, product_name,
image_coordinates) -- the same dict the model interfaces receive.
"""
import json
import re
from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone
from functools import lru_cache
from pathlib import Path

import cv2
import numpy as np
from PIL import Image

from .paths import IMAGES_DIR, PLANOGRAM_PATH

try:
    from zoneinfo import ZoneInfo
    LISBON = ZoneInfo("Europe/Lisbon")
except Exception:  # no tz database on this machine: the dataset day (2025-06-27) is summer time
    LISBON = timezone(timedelta(hours=1), "WEST")

IMAGE_SIZE = (1280, 720)  # (W, H) of every camera in the dataset
CORNERS = ("top_left", "top_right", "bottom_right", "bottom_left")
# Cameras that see each other's gondolas from another angle (SIFT-verified in session d61df52e).
# Each crate is a planogram area of only one camera of the pair.
OVERLAP_PAIRS = [("6383", "6386"), ("6591", "6594"), ("6371", "6376"), ("6373", "6385"), ("6462", "6468")]
IMAGE_EXTS = (".jpg", ".jpeg", ".png")
OTHER_IMAGE_EXTS = (".webp", ".tif", ".tiff", ".bmp", ".gif", ".heic", ".jfif")  # not read: list_images warns
# Recognising a camera by appearance: our photos score >= 0.8 against their own camera (5th percentile, leave-one-out;
# the 06:12 curtain photo 0.30), other cameras <= 0.33, and a screenshot, noise or a mirrored photo <= 0.38.
MIN_ID_SCORE = 0.5
# ... and the best camera must beat the second best by this much (our photos: smallest margin 0.148, leave-one-out),
# so look-alike views (e.g. the 6383 and 6386 curtain walls) are never guessed.
MIN_ID_MARGIN = 0.10


@lru_cache(maxsize=None)
def _read_json(path):
    with open(path, encoding="utf-8") as f:
        return json.load(f)


def load_planogram(path=PLANOGRAM_PATH):
    """{cam_id: [area, ...]} in planogram order. The dicts are cached and shared: don't mutate them."""
    cams = _read_json(str(path))["Frutas e Legumes"]["cameras"]
    return {cam: v["products"] for cam, v in cams.items()}


def areas_by_id(path=PLANOGRAM_PATH):
    """{area_id: area} over all cameras."""
    return {a["area_id"]: a for areas in load_planogram(path).values() for a in areas}


def area_cam(area):
    """Camera id of an area ('6215_2' -> '6215')."""
    return area["area_id"].split("_")[0]


@dataclass(frozen=True, order=True)
class ImageRec:
    cam: str
    ts: int  # unix capture time (the file name)
    path: Path = field(compare=False)

    @property
    def fname(self):
        """Key used in annotations.json and submissions, e.g. '1751052241.jpg'."""
        return self.path.name

    @property
    def time(self):
        """Capture time in Lisbon local time."""
        return datetime.fromtimestamp(self.ts, LISBON)

    @property
    def hhmm(self):
        return self.time.strftime("%H:%M")


_TS = re.compile(r"\d{10}")


def parse_path(path, cams):
    """(cam, ts) from .../6215/1751009590.jpg or a name like 6215_1751009590.jpg; None if absent."""
    cam, ts, _ = camera_from_path(path, cams)
    return cam, ts


def camera_from_path(path, cams):
    """(cam, ts, how): the camera from the path, nearest folder first. A folder named exactly like a planogram camera
    wins; otherwise a folder whose digit runs contain exactly one planogram camera id ("camera_6215", "6215_photos",
    "cam-6215"), then the file name ("6215_1751009590.jpg"). how says which part was used ("" for an exact folder,
    None when no camera id is in the path)."""
    path = Path(path)
    m = _TS.search(path.stem)
    ts = int(m.group()) if m else None
    for part in reversed(path.parent.parts):
        if part in cams:
            return part, ts, ""
    for part in reversed(path.parent.parts):
        ids = {tok for tok in re.split(r"[^0-9]+", part) if tok in cams}
        if len(ids) == 1:
            return ids.pop(), ts, f"folder name '{part}'"
    ids = {tok for tok in re.split(r"[^0-9]+", path.stem) if tok in cams}
    if len(ids) == 1:
        return ids.pop(), ts, f"file name '{path.name}'"
    return None, ts, None


def list_images(root=IMAGES_DIR, planogram_path=PLANOGRAM_PATH, identify=True, skipped=None):
    """Every image under `root` as ImageRec, sorted by (cam, ts).

    The camera comes from the path (camera_from_path: a folder named like a camera, a folder or file name holding
    exactly one camera id); when there is none and identify=True, it is recognised by appearance with
    identify_camera(), which needs our dataset (SENSEI_DATASET). A photo whose camera can't be told (no id, no match
    with score >= MIN_ID_SCORE, unreadable) is left out with a WARN, and so are image files in formats we don't read;
    their paths are appended to `skipped` when a list is given. If no photo at all can be placed, it raises
    ValueError with what to do."""
    cams = set(load_planogram(planogram_path))
    recs, unread, told = [], [], set()
    skipped = [] if skipped is None else skipped
    for p in sorted(Path(root).rglob("*")):
        if p.name.startswith("._") or "__MACOSX" in p.parts:
            continue
        if p.suffix.lower() in OTHER_IMAGE_EXTS:
            unread.append(p.name)
            continue
        if p.suffix.lower() not in IMAGE_EXTS:
            continue
        cam, ts, how = camera_from_path(p, cams)
        if how and how.startswith("folder") and how not in told:  # once per folder
            told.add(how)
            print(f"WARN  camera {cam} taken from the {how}")
        elif how and how.startswith("file") and "file" not in told:
            told.add("file")
            print(f"WARN  cameras taken from the file names (e.g. {p.name} -> {cam})")
        if cam is None and identify:
            try:
                cam, score, gap = identify_camera(p, cams, margin=True)
            except Exception as e:  # unreadable file: its camera (so its areas) can't be known
                print(f"WARN  {p}: can't read it to recognise the camera ({e!r}); NOT predicted")
                skipped.append(str(p))
                continue
            if cam is not None and score < MIN_ID_SCORE:
                print(f"WARN  {p}: looks like no planogram camera (best {cam}, score {score:.2f} < {MIN_ID_SCORE}); "
                      "NOT predicted")
                skipped.append(str(p))
                continue
            if cam is not None and gap < MIN_ID_MARGIN:
                print(f"WARN  {p}: looks like {cam} but another camera is almost as close (margin {gap:.2f} < "
                      f"{MIN_ID_MARGIN}); not guessed, put it in a <camera>/ folder. NOT predicted")
                skipped.append(str(p))
                continue
            if cam is not None:
                print(f"WARN  {p}: camera not in the path, recognised as {cam} by appearance (score {score:.2f}, "
                      f"margin {gap:.2f})")
        if cam is None:
            print(f"WARN  {p}: no camera id in the path and no recognition (set SENSEI_DATASET); NOT predicted")
            skipped.append(str(p))
            continue
        recs.append(ImageRec(cam, ts if ts is not None else 0, p))
    if unread:
        print(f"WARN  {len(unread)} image files in a format we don't read, NOT predicted: {unread[:10]}")
        skipped += unread
    if not recs and skipped:
        raise ValueError(f"no photo under {root} could be placed on a camera: put the photos in <camera>/ folders "
                         "(e.g. 6215/ or camera_6215/) or name them <camera>_<timestamp>.jpg, or set SENSEI_DATASET "
                         "to our dataset folder so cameras can be recognised by appearance")
    return sorted(recs)


def load_image(path):
    """RGB PIL image."""
    with Image.open(path) as im:
        return im.convert("RGB")


def neighbors(cam, ts, k=2, images=None):
    """The k dataset images of camera `cam` closest in time to `ts` (the same timestamp excluded)."""
    images = list_images() if images is None else images
    same = [r for r in images if r.cam == cam and r.ts != ts]
    return sorted(same, key=lambda r: abs(r.ts - ts))[:k]


def _thumb(img):
    """Zero-mean, unit-norm edge map of a 128x72 thumbnail: the fixed shelf structure tells the cameras
    apart regardless of lighting (leave-one-out on the 181 images: 0 errors; raw gray thumbs had 1)."""
    if isinstance(img, Image.Image):
        g = img.convert("L").resize((128, 72), Image.BILINEAR)
    else:
        with Image.open(img) as im:
            g = im.convert("L").resize((128, 72), Image.BILINEAR)
    g = np.asarray(g, dtype=np.float32)
    m = np.hypot(cv2.Sobel(g, cv2.CV_32F, 1, 0), cv2.Sobel(g, cv2.CV_32F, 0, 1))
    m = m - m.mean()
    return m / (np.linalg.norm(m) + 1e-6)


@lru_cache(maxsize=1)
def _camera_refs():
    """{cam: stacked thumbs of our photos} from the dataset's <cam>/ folders; {} when the dataset isn't there."""
    if not IMAGES_DIR.is_dir():
        return {}
    return {d.name: np.stack([_thumb(p) for p in sorted(d.glob("*.jpg"))])
            for d in sorted(IMAGES_DIR.iterdir()) if d.is_dir() and any(d.glob("*.jpg"))}


# Night curtain pulled over the display of these cameras (our 06:12 photos). Sensei counts it as empty;
# the user's rule: empty + compliant for every area, and such photos are left out of training/evaluation.
CURTAIN_PHOTOS = {"6383": "1751001156.jpg", "6386": "1751001156.jpg"}


@lru_cache(maxsize=1)
def _curtain_refs():
    """{cam: (thumb of our curtain photo, stacked thumbs of our normal photos)}."""
    out = {}
    for cam, fname in CURTAIN_PHOTOS.items():
        files = sorted((IMAGES_DIR / cam).glob("*.jpg"))
        curtain = [f for f in files if f.name == fname]
        normal = [f for f in files if f.name != fname]
        if curtain and normal:
            out[cam] = (_thumb(curtain[0]), np.stack([_thumb(f) for f in normal]))
    return out


def curtain_down(img, cam):
    """(is_curtain, margin) for a photo (path or PIL) of camera `cam`: True when it looks more like our
    curtain photo than like any of our normal photos of that camera (on our data normal photos sit at
    a margin <= -0.64, and darker/brighter/noisy/shifted copies of the curtain photo are all caught).
    Always (False, 0.0) for cameras without a curtain."""
    refs = _curtain_refs().get(str(cam))
    if refs is None:
        return False, 0.0
    t = _thumb(img)
    margin = float((refs[0] * t).sum()) - float((refs[1] * t).sum(axis=(1, 2)).max())
    return margin > 0, margin


def identify_camera(img, cams=None, margin=False):
    """(cam, correlation) of the dataset camera that best matches an image (path or PIL); (None, 0.0) without the
    dataset. cams: only consider these camera ids. margin=True returns (cam, correlation, best minus second best)."""
    t = _thumb(img)
    scores = {cam: float((refs * t).sum(axis=(1, 2)).max()) for cam, refs in _camera_refs().items()
              if cams is None or cam in cams}
    if not scores:
        return (None, 0.0, 0.0) if margin else (None, 0.0)
    ranked = sorted(scores.values(), reverse=True)
    cam = max(scores, key=scores.get)
    gap = ranked[0] - ranked[1] if len(ranked) > 1 else ranked[0]
    return (cam, scores[cam], gap) if margin else (cam, scores[cam])


@lru_cache(maxsize=None)
def _drift_ref(cam):
    """Gradient map (360x640) of our newest photo of `cam`, or None without the dataset."""
    files = sorted((IMAGES_DIR / cam).glob("*.jpg")) if (IMAGES_DIR / cam).is_dir() else []
    return _grad(Image.open(files[-1]).convert("L").resize((640, 360), Image.BILINEAR)) if files else None


def _grad(g):
    g = np.asarray(g, dtype=np.float32)
    return np.hypot(cv2.Sobel(g, cv2.CV_32F, 1, 0), cv2.Sobel(g, cv2.CV_32F, 0, 1))


def camera_drift(img, cam):
    """(shift in px at 1280x720, response) of a photo against our newest photo of the same camera, by phase
    correlation of gradient maps; None without the dataset. Warn-only: answers never depend on it."""
    ref = _drift_ref(str(cam))
    if ref is None:
        return None
    cur = _grad(img.convert("L").resize((640, 360), Image.BILINEAR))
    (dx, dy), resp = cv2.phaseCorrelate(ref, cur, cv2.createHanningWindow((640, 360), cv2.CV_32F))
    return 2 * float(np.hypot(dx, dy)), float(resp)
