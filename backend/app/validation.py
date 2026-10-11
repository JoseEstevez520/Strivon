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

from fastapi import APIRouter, File, HTTPException, UploadFile
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
            "cameras": [], "layout": None, "expect_images": None, "expect_areas": None}


class RunBody(BaseModel):
    expect_images: int = 26
    expect_areas: int = 289
    stock_mode: str | None = None


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
        d = {k: v for k, v in _s.items() if k not in ("cameras", "layout", "expect_images", "expect_areas")}
        d["log"] = list(_s["log"][-300:]) if with_log else []
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
                  validator=None, exit_code=None, seconds=None, cameras=[], layout=None)
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
        _s.update(state="uploaded", photos=len(all_files), cameras=cams, layout=layout)
        out = {"session": _s["session"], "count": len(all_files),
               "cameras": [CAMERA_ID.search(c).group(1) for c in cams], "layout": layout}
    return out


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


def _job(sess: Path, expect_images: int, expect_areas: int, stock_mode: str | None) -> None:
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
    with _lock:
        if _s["state"] == "running":
            raise HTTPException(409, "a run is already in progress")
        if not _s["session"] or not _s["photos"]:
            raise HTTPException(409, "upload photos first")
        sess = SESSIONS / _s["session"]
        _s.update(state="running", log=[], verdict=None, last_line=None, validator=None, exit_code=None,
                  seconds=None, expect_images=body.expect_images, expect_areas=body.expect_areas)
    threading.Thread(target=_job, args=(sess, body.expect_images, body.expect_areas, body.stock_mode),
                     daemon=True).start()
    return {"ok": True, "session": sess.name}


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
