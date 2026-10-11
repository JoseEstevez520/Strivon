"""Validation day runner: upload the hidden photos, run the submission predictor, check the file.

Only calls the documented commands (docs/VALIDATION_DAY.md); it never touches model code.
Everything lives under outputs/validation/<UTC timestamp>/ (ignored by git).
"""
from __future__ import annotations

import json
import os
import re
import subprocess
import sys
import threading
import time
from datetime import datetime, timezone
from pathlib import Path, PurePosixPath

from fastapi import APIRouter, File, HTTPException, Request, UploadFile
from fastapi.responses import FileResponse
from pydantic import BaseModel

REPO = Path(__file__).resolve().parents[2]
SESSIONS = REPO / "outputs" / "validation"
DATA = REPO / "data"
PLANOGRAM = DATA / "planogram.json"
IMAGES_FOLDER_NAME = "Frutas e Legumes (train & test)"

ALLOWED = {".jpg", ".jpeg", ".png"}
MAX_BYTES = 20 * 1024 * 1024
MAX_FILES = 200
CAMERA_DIR = re.compile(r"^(?:camera_)?\d+$", re.I)
CAMERA_ID = re.compile(r"(\d+)")
VERDICTS = {0: "OK", 1: "INVALID", 2: "FALLBACKS", 3: "INCOMPLETE"}

router = APIRouter(prefix="/api/validation")
_lock = threading.Lock()
_s: dict = {"state": "idle", "session": None, "photos": 0, "log": [], "verdict": None,
            "last_line": None, "validator": None, "exit_code": None, "seconds": None,
            "cameras": [], "layout": None, "expect_images": None, "expect_areas": None,
            "calib_used": False, "auto_areas": None}


class RunBody(BaseModel):
    expect_images: int = 26
    expect_areas: int | None = None   # None: worked out from the uploaded photos
    stock_mode: str | None = None
    use_calibration: bool = False


def _clean_parts(name: str) -> list[str]:
    parts = [p for p in PurePosixPath((name or "").replace("\\", "/")).parts if p not in ("", ".", "/")]
    if any(p == ".." or ":" in p or "\x00" in p for p in parts):
        raise HTTPException(400, f"bad file name: {name!r}")
    return parts


def _target(name: str) -> tuple[str | None, str]:
    """(camera folder or None, file name). Keeps `<camera>/<name>` and drops any folders above it."""
    parts = _clean_parts(name)
    if not parts:
        raise HTTPException(400, "empty file name")
    fname = re.sub(r"[^A-Za-z0-9._ -]", "_", parts[-1])
    if Path(fname).suffix.lower() not in ALLOWED:
        raise HTTPException(400, f"only .jpg/.jpeg/.png accepted: {parts[-1]!r}")
    if len(parts) >= 2 and CAMERA_DIR.match(parts[-2]):
        return parts[-2], fname
    return None, fname


def _snapshot(with_log: bool = True) -> dict:
    with _lock:
        d = {k: v for k, v in _s.items()
             if k not in ("cameras", "layout", "expect_images", "expect_areas", "calib_used", "auto_areas")}
        d["log"] = list(_s["log"][-300:]) if with_log else []
        stored = _calib_products(SESSIONS / _s["session"] / "calib.json") if _s["session"] else 0
        d["expected_areas"] = _s["auto_areas"]
        d["calibration"] = {"used": bool(_s["calib_used"]), "products": stored}
        return d


def _log(line: str) -> None:
    with _lock:
        _s["log"].append(line.rstrip("\n"))
        del _s["log"][:-2000]


def _new_session() -> Path:
    stamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%S%fZ")
    sess = SESSIONS / stamp
    (sess / "photos").mkdir(parents=True)
    with _lock:
        _s.update(state="idle", session=stamp, photos=0, log=[], verdict=None, last_line=None,
                  validator=None, exit_code=None, seconds=None, cameras=[], layout=None, calib_used=False,
                  auto_areas=None)
    return sess


def _current() -> Path:
    if not _s["session"]:
        raise HTTPException(409, "no session yet: upload photos first")
    return SESSIONS / _s["session"]


@router.post("/upload")
async def upload(files: list[UploadFile] = File(...), append: int = 0):
    if _s["state"] == "running":
        raise HTTPException(409, "a run is in progress")
    if not files or len(files) > MAX_FILES:
        raise HTTPException(400, f"send between 1 and {MAX_FILES} files")
    # Check every name before writing anything.
    plan = [(f, *_target(f.filename or "")) for f in files]
    sess = _current() if (append and _s["session"]) else _new_session()
    photos = sess / "photos"
    for f, cam, fname in plan:
        d = photos / cam if cam else photos
        d.mkdir(exist_ok=True)
        dest = d / fname
        n = 1
        while dest.exists():  # flat folders can repeat a name
            dest = d / f"{Path(fname).stem}_{n}{Path(fname).suffix}"
            n += 1
        size = 0
        with dest.open("wb") as out:
            while chunk := await f.read(1 << 20):
                size += len(chunk)
                if size > MAX_BYTES:
                    out.close()
                    dest.unlink(missing_ok=True)
                    raise HTTPException(413, f"{fname} is over {MAX_BYTES // (1 << 20)} MB")
                out.write(chunk)
    all_files = [p for p in photos.rglob("*") if p.is_file()]
    if len(all_files) > MAX_FILES:
        raise HTTPException(400, f"more than {MAX_FILES} photos in the session")
    cams = sorted({p.parent.name for p in all_files if p.parent != photos})
    flat = any(p.parent == photos for p in all_files)
    layout = "flat" if flat or not cams else "camera_folders"
    with _lock:
        auto = _expected_areas(all_files, photos)
        _s.update(state="uploaded", photos=len(all_files), cameras=cams, layout=layout, auto_areas=auto)
        out = {"session": _s["session"], "count": len(all_files),
               "cameras": [CAMERA_ID.search(c).group(1) for c in cams], "layout": layout,
               "expected_areas": auto}
    return out


def _expected_areas(files: list[Path], photos: Path) -> int | None:
    """Planogram areas of the cameras of these photos, one count per photo. Flat uploads cannot be placed by
    name, so only the official 26-photo set gets its known 289; anything else is left to the caller."""
    try:
        cams = json.loads(PLANOGRAM.read_text(encoding="utf-8"))["Frutas e Legumes"]["cameras"]
    except (OSError, ValueError, KeyError):
        return None
    total = 0
    for p in files:
        m = CAMERA_ID.search(p.parent.name) if p.parent != photos else None
        if not m or m.group(1) not in cams:
            return 289 if len(files) == 26 else None
        total += len(cams[m.group(1)]["products"])
    return total


def _dataset_dir(sess: Path) -> Path:
    ds = sess / "dataset"
    ds.mkdir(exist_ok=True)
    for link, target in ((ds / IMAGES_FOLDER_NAME, (DATA / "images").resolve()),
                         (ds / "planogram.json", PLANOGRAM.resolve())):
        if link.is_symlink() or link.exists():
            link.unlink()
        link.symlink_to(target)
    return ds


def _stream(cmd: list[str], env: dict) -> int:
    _log("$ " + " ".join(cmd))
    p = subprocess.Popen(cmd, cwd=REPO, env=env, stdout=subprocess.PIPE, stderr=subprocess.STDOUT,
                         text=True, errors="replace", bufsize=1)
    for line in p.stdout:
        _log(line)
    return p.wait()


def _job(sess: Path, expect_images: int, expect_areas: int, stock_mode: str | None,
         use_calibration: bool = False) -> None:
    t0 = time.time()
    photos, final = sess / "photos", sess / "final.json"
    try:
        final.unlink(missing_ok=True)
        ds = _dataset_dir(sess)
        env = {**os.environ, "SENSEI_DATASET": str(ds), "ONEPASS_THREADS": "1"}
        cmd = [sys.executable, "-I", "agents/predict.py", "--images", str(photos),
               "--planogram", "data/planogram.json", "--out", str(final),
               "--expect-images", str(expect_images), "--expect-areas", str(expect_areas)]
        if stock_mode:
            cmd += ["--stock-model", stock_mode]
        if use_calibration:
            cmd += ["--calibration", str(sess / "calib.json"), "--fill-out", str(sess / "fill.json")]
        code = _stream(cmd, env)
        with _lock:
            last = next((l for l in reversed(_s["log"]) if l.strip()), "")
            _s.update(exit_code=code, last_line=last.strip(), verdict=VERDICTS.get(code, "ERROR"))
        if code == 0 and not last.startswith("OK"):
            with _lock:
                _s["verdict"] = "ERROR"
        if final.exists():
            vcmd = [sys.executable, "-I", "agents/submission/validate.py", str(final),
                    "--images", str(photos), "--planogram", "data/planogram.json"]
            vcode = _stream(vcmd, env)
            summary = next((l for l in reversed(_s["log"]) if " images, " in l and " errors" in l), "")
            m = re.search(r"(\d+) images, (\d+) areas, (\d+) errors", summary)
            if m:
                imgs, areas, errs = map(int, m.groups())
                ok = (_s["verdict"] == "OK" and vcode == 0 and errs == 0
                      and imgs == expect_images and areas == expect_areas)
                with _lock:
                    _s["validator"] = {"images": imgs, "areas": areas, "errors": errs, "ok": ok}
            else:
                with _lock:
                    _s["validator"] = {"images": 0, "areas": 0, "errors": 1, "ok": False}
        with _lock:
            _s["state"] = "done" if _s["verdict"] in VERDICTS.values() else "error"
    except Exception as e:  # noqa: BLE001
        _log(f"runner error: {e}")
        with _lock:
            _s.update(state="error", verdict="ERROR")
    finally:
        with _lock:
            _s["seconds"] = round(time.time() - t0, 1)


@router.post("/run")
def run(body: RunBody | None = None):
    body = body or RunBody()
    if body.stock_mode is not None and not re.fullmatch(r"[A-Za-z0-9_.-]{1,40}", body.stock_mode):
        raise HTTPException(400, "bad stock_mode")
    if body.use_calibration and body.stock_mode:
        raise HTTPException(400, "calibration cannot be combined with stock_mode")
    with _lock:
        if _s["state"] == "running":
            raise HTTPException(409, "a run is already in progress")
        if not _s["session"] or not _s["photos"]:
            raise HTTPException(409, "upload photos first")
        sess = SESSIONS / _s["session"]
        expect_areas = body.expect_areas or _s["auto_areas"] or 289
        if body.use_calibration and not (sess / "calib.json").is_file():
            raise HTTPException(400, "use_calibration is set but no calibration is stored: send one first")
        _s.update(state="running", log=[], verdict=None, last_line=None, validator=None, exit_code=None,
                  seconds=None, expect_images=body.expect_images, expect_areas=expect_areas,
                  calib_used=body.use_calibration)
    threading.Thread(target=_job, args=(sess, body.expect_images, expect_areas, body.stock_mode,
                                        body.use_calibration), daemon=True).start()
    return {"ok": True, "session": sess.name}


# --- optional store calibration (the app's calib.json, version 1) ---------------------------

MAX_CALIB_BYTES = 512 * 1024


def _calib_products(f: Path) -> int:
    try:
        return len(json.loads(f.read_text(encoding="utf-8"))["products"])
    except (OSError, ValueError, KeyError, TypeError):
        return 0


def _num(v) -> bool:
    return isinstance(v, (int, float)) and not isinstance(v, bool) and v == v and abs(v) != float("inf")


def _check_calib(raw) -> None:
    """Shape check only; agents/predict.py has the final say (conflicting lines are refused there)."""
    def bad(msg: str):
        raise HTTPException(400, f"bad calibration: {msg}")
    if not isinstance(raw, dict) or raw.get("version") != 1 or not isinstance(raw.get("products"), dict):
        bad('expected {"version": 1, "products": {...}}')
    if len(raw["products"]) > 2000:
        bad("too many products")
    for pid, r in raw["products"].items():
        if not isinstance(pid, str) or not pid or len(pid) > 80 or not isinstance(r, dict):
            bad(f"product {pid!r}: needs a string id and an object")
        unit, cap = r.get("unit"), r.get("capacity")
        if unit not in ("percent", "count"):
            bad(f"product {pid}: unit must be 'percent' or 'count'")
        if unit == "count" and not (isinstance(cap, int) and not isinstance(cap, bool) and 1 <= cap <= 1000):
            bad(f"product {pid}: a count product needs an integer capacity >= 1")
        top = 100.0 if unit == "percent" else float(cap)
        pts = r.get("points") or []
        if not isinstance(pts, list) or len(pts) > 50:
            bad(f"product {pid}: points must be a short list")
        for p in pts:
            if not isinstance(p, dict) or p.get("level") not in ("empty", "half", "full") \
                    or not _num(p.get("value")) or not 0 <= p["value"] <= top:
                bad(f"product {pid}: bad point (value in [0, {top:g}], level empty/half/full)")
        for key in ("empty_max", "full_min"):
            v = r.get(key)
            if v is not None and not (_num(v) and 0 <= v <= top):
                bad(f"product {pid}: {key} must be null or a number in [0, {top:g}]")


@router.post("/calibration")
async def put_calibration(request: Request):
    if _s["state"] == "running":
        raise HTTPException(409, "a run is in progress")
    raw_bytes = await request.body()
    if len(raw_bytes) > MAX_CALIB_BYTES:
        raise HTTPException(413, "calibration file is too large")
    try:
        raw = json.loads(raw_bytes.decode("utf-8"))
    except ValueError:
        raise HTTPException(400, "bad calibration: not valid JSON") from None
    _check_calib(raw)
    (_current() / "calib.json").write_text(json.dumps(raw, indent=1), encoding="utf-8")
    return {"ok": True, "products": len(raw["products"])}


@router.delete("/calibration")
def delete_calibration():
    if _s["state"] == "running":
        raise HTTPException(409, "a run is in progress")
    (_current() / "calib.json").unlink(missing_ok=True)
    return {"ok": True, "products": 0}


@router.get("/status")
def status():
    return _snapshot()


def _checked_final() -> Path:
    v = _s["validator"]
    if _s["state"] != "done" or _s["verdict"] != "OK" or not v or not v["ok"]:
        raise HTTPException(404, "no checked result: the last run did not pass every check")
    f = _current() / "final.json"
    if not f.exists():
        raise HTTPException(404, "final.json missing")
    return f


@router.get("/result")
def result():
    return FileResponse(_checked_final(), media_type="application/json", filename="final.json")


@router.get("/summary")
def summary():
    data = json.loads(_checked_final().read_text(encoding="utf-8"))
    cams, tot = {}, {"empty": 0, "half": 0, "full": 0, "non_compliant": 0, "areas": 0}
    for cam, imgs in data.items():
        c = cams.setdefault(cam, {"images": 0, "empty": 0, "half": 0, "full": 0, "non_compliant": 0, "areas": 0})
        for areas in imgs.values():
            c["images"] += 1
            for a in areas.values():
                lvl = a.get("stock_level")
                if lvl in ("empty", "half", "full"):
                    c[lvl] += 1
                    tot[lvl] += 1
                if not a.get("planogram_compliant", True):
                    c["non_compliant"] += 1
                    tot["non_compliant"] += 1
                c["areas"] += 1
                tot["areas"] += 1
    tot["images"] = sum(c["images"] for c in cams.values())
    return {"cameras": cams, "totals": tot}


# --- look at a finished run inside the normal app ---------------------------------------------

_NAME = re.compile(r"^[A-Za-z0-9._ -]{1,120}$")
_CAM = re.compile(r"^[A-Za-z0-9_-]{1,40}$")


def _photo_files(sess: Path) -> list[tuple[Path, str | None]]:
    photos = sess / "photos"
    return sorted(((p, p.parent.name if p.parent != photos else None) for p in photos.rglob("*")
                   if p.is_file() and p.suffix.lower() in ALLOWED), key=lambda x: str(x[0]))


def _camera_of(final: dict, name: str, folder: str | None) -> str | None:
    """The camera key of final.json that holds this photo. Flat uploads are placed by the file name."""
    if folder:
        m = CAMERA_ID.search(folder)
        if m and m.group(1) in final:
            return m.group(1)
    for cam, imgs in final.items():
        if name in imgs:
            return cam
    return None


@router.get("/predictions")
def predictions():
    return FileResponse(_checked_final(), media_type="application/json")


@router.get("/index")
def view_index():
    final = json.loads(_checked_final().read_text(encoding="utf-8"))
    images: dict[str, list[str]] = {}
    for p, folder in _photo_files(_current()):
        cam = _camera_of(final, p.name, folder)
        if cam and p.name not in images.setdefault(cam, []):
            images[cam].append(p.name)
    return {"planogram": json.loads(PLANOGRAM.read_text(encoding="utf-8")), "images": images}


@router.get("/photo/{camera}/{image}")
def view_photo(camera: str, image: str):
    if not _CAM.match(camera) or not _NAME.match(image) or ".." in image:
        raise HTTPException(400, "bad name")
    final = json.loads(_checked_final().read_text(encoding="utf-8"))
    for p, folder in _photo_files(_current()):
        if p.name == image and _camera_of(final, p.name, folder) == camera:
            return FileResponse(p, headers={"cache-control": "no-store"})
    raise HTTPException(404, "photo not found")
