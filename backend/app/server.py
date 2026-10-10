"""Staff dashboard + labelling tool (FastAPI).

Run from backend/:  python -m sensei serve   (then open http://127.0.0.1:8000)
"""
from __future__ import annotations

import json
import threading
import traceback
from functools import lru_cache
from pathlib import Path

import cv2
from fastapi import Body, FastAPI, HTTPException
from fastapi.responses import FileResponse, JSONResponse, Response
from fastapi.staticfiles import StaticFiles

from sensei import config
from sensei.geometry import rectify
from sensei.planogram import load_planogram
from sensei.scoring import score

STATIC = Path(__file__).parent / "static"
DETAILS = config.OUTPUTS_DIR / "details.json"
SUBMISSION = config.PREDICTIONS_PATH
ANN_PATH = config.LABELS_PATH

app = FastAPI(title="Strivon")
_lock = threading.Lock()
_job = {"running": False, "log": [], "error": None}


def _details() -> dict:
    if not DETAILS.exists():
        raise HTTPException(503, "No predictions yet. Run `python -m sensei predict` from backend/.")
    return _load_details(DETAILS.stat().st_mtime)


@lru_cache(maxsize=2)
def _load_details(_mtime: float) -> dict:
    return json.loads(DETAILS.read_text(encoding="utf-8"))


def _image_path(cam: str, image: str) -> Path:
    d = _details()
    for r in d["images"].get(cam, []):
        if r["image"] == image:
            return Path(r["path"])
    p = config.IMAGES_DIR / cam / image
    if p.exists() and p.parent.parent == config.IMAGES_DIR:
        return p
    raise HTTPException(404, "unknown image")


def _read_ann() -> dict:
    if ANN_PATH.exists():
        return json.loads(ANN_PATH.read_text(encoding="utf-8"))
    return {}


def _write_ann(d: dict) -> None:
    ANN_PATH.parent.mkdir(parents=True, exist_ok=True)
    tmp = ANN_PATH.with_suffix(".tmp")
    tmp.write_text(json.dumps(d, indent=1, ensure_ascii=False), encoding="utf-8")
    tmp.replace(ANN_PATH)


@app.get("/api/state")
def state():
    d = _details()
    return JSONResponse(d)


@app.get("/api/image/{cam}/{image}")
def image(cam: str, image: str, w: int = 0):
    p = _image_path(cam, image)
    if not w:
        return FileResponse(p, media_type="image/jpeg", headers={"Cache-Control": "max-age=86400"})
    return Response(_thumb(str(p), w), media_type="image/jpeg", headers={"Cache-Control": "max-age=86400"})


@lru_cache(maxsize=512)
def _thumb(path: str, w: int) -> bytes:
    im = cv2.imread(path)
    h = int(im.shape[0] * w / im.shape[1])
    ok, buf = cv2.imencode(".jpg", cv2.resize(im, (w, h), interpolation=cv2.INTER_AREA), [cv2.IMWRITE_JPEG_QUALITY, 82])
    return buf.tobytes()


@app.get("/api/crop/{cam}/{image}/{area_id}")
def crop(cam: str, image: str, area_id: str):
    p = _image_path(cam, image)
    return Response(_crop(str(p), area_id), media_type="image/jpeg", headers={"Cache-Control": "max-age=86400"})


@lru_cache(maxsize=4096)
def _crop(path: str, area_id: str) -> bytes:
    pg = load_planogram()
    a = pg.area(area_id)
    im = cv2.imread(path)
    c, _ = rectify(im, a.quad, (288, 216))
    ok, buf = cv2.imencode(".jpg", c, [cv2.IMWRITE_JPEG_QUALITY, 85])
    return buf.tobytes()


# --- annotations ------------------------------------------------------------------

@app.get("/api/annotations")
def get_annotations():
    return _read_ann()


@app.put("/api/annotations/{cam}/{image}/{area_id}")
def put_annotation(cam: str, image: str, area_id: str, body: dict = Body(...)):
    level = body.get("stock_level")
    if level not in config.STOCK_LEVELS:
        raise HTTPException(400, "stock_level must be empty|half|full")
    with _lock:
        d = _read_ann()
        d.setdefault(cam, {}).setdefault(image, {})[area_id] = {
            "planogram_compliant": bool(body.get("planogram_compliant", True)),
            "stock_level": level,
            "stock_value": config.STOCK_LEVELS[level],
        }
        _write_ann(d)
    return {"ok": True}


@app.delete("/api/annotations/{cam}/{image}/{area_id}")
def delete_annotation(cam: str, image: str, area_id: str):
    with _lock:
        d = _read_ann()
        d.get(cam, {}).get(image, {}).pop(area_id, None)
        if cam in d and image in d[cam] and not d[cam][image]:
            d[cam].pop(image)
        if cam in d and not d[cam]:
            d.pop(cam)
        _write_ann(d)
    return {"ok": True}


@app.get("/api/score")
def get_score():
    ann = {}
    for p in [ANN_PATH] if ANN_PATH.exists() else []:
        for cam, imgs in json.loads(p.read_text(encoding="utf-8")).items():
            for img, areas in imgs.items():
                ann.setdefault(cam, {}).setdefault(img, {}).update(areas)
    sub = json.loads(SUBMISSION.read_text(encoding="utf-8")) if SUBMISSION.exists() else {}
    rep = score(sub, ann).to_json()
    cal = config.OUTPUTS_DIR / "calibration.json"
    rep["calibration"] = json.loads(cal.read_text()) if cal.exists() else None
    return rep


# --- re-run the pipeline from the UI ----------------------------------------------

def _run_job(calibrate_first: bool):
    from sensei import calibrate as cal_mod
    from sensei.pipeline import run, write

    def log(msg):
        _job["log"].append(str(msg))
        _job["log"] = _job["log"][-200:]

    try:
        if calibrate_first:
            paths = [ANN_PATH] if ANN_PATH.exists() else []
            if not paths:
                raise RuntimeError("No labels to calibrate with.")
            cal_mod.fit(paths, log=log)
        res = run(config.IMAGES_DIR, [], log=log)
        write(res, SUBMISSION, DETAILS)
        log("Done.")
    except SystemExit as e:
        _job["error"] = str(e)
    except Exception as e:  # noqa: BLE001
        _job["error"] = f"{e}"
        log(traceback.format_exc())
    finally:
        _job["running"] = False


@app.post("/api/run")
def run_pipeline(body: dict = Body(default={})):
    if _job["running"]:
        raise HTTPException(409, "Already running")
    _job.update(running=True, log=[], error=None)
    threading.Thread(target=_run_job, args=(bool(body.get("calibrate")),), daemon=True).start()
    return {"ok": True}


@app.get("/api/run")
def run_status():
    return _job


@app.get("/api/export/predictions.json")
def export_submission():
    if not SUBMISSION.exists():
        raise HTTPException(404)
    return FileResponse(SUBMISSION, media_type="application/json", filename="predictions.json")


@app.get("/api/export/labels.json")
def export_annotations():
    return Response(json.dumps(_read_ann(), indent=1, ensure_ascii=False), media_type="application/json",
                    headers={"Content-Disposition": "attachment; filename=labels.json"})


@app.middleware("http")
async def _no_stale_ui(request, call_next):
    resp = await call_next(request)
    if not request.url.path.startswith("/api/"):
        resp.headers["Cache-Control"] = "no-cache"  # always revalidate HTML/JS/CSS during the hackathon
    return resp


app.mount("/", StaticFiles(directory=STATIC, html=True), name="static")
