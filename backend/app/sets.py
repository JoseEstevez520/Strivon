"""Several validation sets side by side: list, details, labels and the official score.

A set is a folder in outputs/validation/ (written by app/validation.py). This module only reads
those folders, plus its own `meta.json` and `labels.json` inside them. It never touches the runner.
"""
from __future__ import annotations

import importlib.util
import json
import re
import shutil
from datetime import datetime, timezone
from pathlib import Path

from fastapi import APIRouter, Body, HTTPException
from pydantic import BaseModel

from app import validation

REPO = Path(__file__).resolve().parents[2]
SESSIONS = validation.SESSIONS
TEAM_LABELS = REPO / "eval" / "labels.json"
ID_RE = re.compile(r"^[A-Za-z0-9_-]{1,64}$")
LEVELS = ("empty", "half", "full")

router = APIRouter(prefix="/api/sets")


def _official():
    spec = importlib.util.spec_from_file_location("official_score", REPO / "eval" / "score.py")
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


def _dir(sid: str) -> Path:
    if not ID_RE.match(sid):
        raise HTTPException(400, "bad set id")
    p = (SESSIONS / sid).resolve()
    if p.parent != SESSIONS.resolve() or not p.is_dir():
        raise HTTPException(404, "no such set")
    return p


def _read(p: Path):
    try:
        return json.loads(p.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return None


def _created(sid: str) -> str:
    m = re.match(r"^(\d{8}T\d{6})", sid)
    if m:
        try:
            return datetime.strptime(m.group(1), "%Y%m%dT%H%M%S").replace(tzinfo=timezone.utc).isoformat()
        except ValueError:
            pass
    return ""


def _meta(d: Path) -> dict:
    m = _read(d / "meta.json")
    m = m if isinstance(m, dict) else {}
    return {"name": str(m.get("name") or d.name), "created": str(m.get("created") or _created(d.name)),
            "source": str(m.get("source") or "upload")}


def _write_meta(d: Path, **changes) -> dict:
    m = _meta(d)
    m.update(changes)
    (d / "meta.json").write_text(json.dumps(m, indent=1), encoding="utf-8")
    return m


def _count_photos(d: Path) -> int:
    ph = d / "photos"
    return sum(1 for p in ph.rglob("*") if p.is_file()) if ph.is_dir() else 0


def _final(d: Path):
    f = _read(d / "final.json")
    return f if isinstance(f, dict) else None


def _n_areas(final: dict) -> int:
    return sum(len(a) for imgs in final.values() if isinstance(imgs, dict) for a in imgs.values() if isinstance(a, dict))


def _status(d: Path, final) -> str:
    cur = validation._s
    if cur.get("session") == d.name and cur.get("state") in ("running", "uploaded"):
        return cur["state"]
    return "done" if final is not None else "failed"


def _pct(n: int, total: int) -> float:
    return round(100 * n / total, 1) if total else 0.0


def _counts(areas) -> dict:
    c = {"empty": 0, "half": 0, "full": 0, "not_compliant": 0, "areas": 0, "images": 0}
    for a in areas:
        c["areas"] += 1
        if a.get("stock_level") in LEVELS:
            c[a["stock_level"]] += 1
        if not a.get("planogram_compliant", True):
            c["not_compliant"] += 1
    return c


def _with_pct(c: dict) -> dict:
    n = c["areas"]
    return {**c, **{f"{k}_pct": _pct(c[k], n) for k in (*LEVELS, "not_compliant")}}


def _item(d: Path) -> dict:
    final = _final(d)
    m = _meta(d)
    cur = validation._s
    return {"id": d.name, **m, "photos": _count_photos(d), "areas": _n_areas(final) if final else 0,
            "has_labels": (d / "labels.json").is_file(), "status": _status(d, final),
            "verdict": cur.get("verdict") if cur.get("session") == d.name else None}


@router.get("")
def list_sets():
    if not SESSIONS.is_dir():
        return []
    dirs = [p for p in SESSIONS.iterdir() if p.is_dir() and ID_RE.match(p.name)]
    items = [_item(p) for p in dirs]
    items.sort(key=lambda i: (i["created"], i["id"]), reverse=True)
    return items


@router.get("/{sid}")
def details(sid: str):
    d = _dir(sid)
    final = _final(d)
    out = _item(d)
    out["cameras"], out["totals"], out["images"] = {}, None, {}
    if final:
        tot_areas: list = []
        for cam, imgs in sorted(final.items(), key=lambda kv: kv[0]):
            if not isinstance(imgs, dict):
                continue
            areas = [a for im in imgs.values() if isinstance(im, dict) for a in im.values() if isinstance(a, dict)]
            c = _counts(areas)
            c["images"] = len(imgs)
            out["cameras"][cam] = _with_pct(c)
            out["images"][cam] = sorted(imgs)
            tot_areas += areas
        t = _counts(tot_areas)
        t["images"] = sum(c["images"] for c in out["cameras"].values())
        out["totals"] = _with_pct(t)
    out["score"] = _score(d, final) if final and out["has_labels"] else None
    return out


def _check_labels(data) -> dict:
    if not isinstance(data, dict) or not data:
        raise HTTPException(400, "labels must be {camera: {image: {area_id: {...}}}}")
    n = 0
    for cam, imgs in data.items():
        if not isinstance(imgs, dict):
            raise HTTPException(400, f"camera {cam!r}: expected an object of images")
        for img, areas in imgs.items():
            if not isinstance(areas, dict):
                raise HTTPException(400, f"{cam}/{img}: expected an object of areas")
            for aid, a in areas.items():
                try:
                    ok = isinstance(a, dict) and isinstance(a["planogram_compliant"], bool) and \
                        not isinstance(a["stock_value"], bool) and float(a["stock_value"]) is not None
                except (KeyError, TypeError, ValueError):
                    ok = False
                if not ok:
                    raise HTTPException(400, f"{cam}/{img}/{aid}: needs planogram_compliant (bool) and stock_value (number)")
                n += 1
    if n == 0:
        raise HTTPException(400, "labels hold no areas")
    return data


def _restrict(labels: dict, final: dict) -> dict:
    """Keep only the photos that the set actually holds."""
    out: dict = {}
    for cam, imgs in labels.items():
        have = final.get(cam)
        if not isinstance(have, dict):
            continue
        keep = {i: a for i, a in imgs.items() if i in have}
        if keep:
            out[cam] = keep
    return out


@router.post("/{sid}/labels")
def set_labels(sid: str, body: dict = Body(...)):
    d = _dir(sid)
    final = _final(d)
    if body.get("use") == "team" and len(body) == 1:
        labels = _read(TEAM_LABELS)
        if labels is None:
            raise HTTPException(404, "team labels (eval/labels.json) not found")
        source = "team"
    else:
        labels, source = body, "upload"
    _check_labels(labels)
    if final is not None:
        labels_all = sum(len(a) for imgs in labels.values() for a in imgs.values())
        labels = _restrict(labels, final)
        if not labels:
            raise HTTPException(400, "none of the labelled photos is in this set")
    else:
        labels_all = None
    (d / "labels.json").write_text(json.dumps(labels, indent=1), encoding="utf-8")
    (d / "labels_source.txt").write_text(source, encoding="utf-8")
    return {"ok": True, "source": source, "areas": sum(len(a) for i in labels.values() for a in i.values()),
            "dropped": (labels_all - sum(len(a) for i in labels.values() for a in i.values())) if labels_all is not None else 0}


def _score(d: Path, final: dict) -> dict:
    labels = _read(d / "labels.json")
    if not isinstance(labels, dict):
        raise HTTPException(404, "this set has no labels")
    off = _official()
    # Only the areas the labels cover are scored; the rest are reported, never counted wrong.
    truth, unlabelled = {}, 0
    for cam, imgs in final.items():
        for img, areas in imgs.items():
            tl = labels.get(cam, {}).get(img)
            for aid in areas:
                if tl is None or aid not in tl:
                    unlabelled += 1
    for cam, imgs in labels.items():
        if cam in final:
            for img, areas in imgs.items():
                if img in final[cam]:
                    truth.setdefault(cam, {})[img] = areas
    r = off.score(final, truth)
    n = r["areas"]
    missing = 0
    worst = []
    per_cam = {}
    for cam, imgs in truth.items():
        sub = off.score(final, {cam: imgs})
        per_cam[cam] = {"total": sub["total"], "max": sub["max"], "percent": _pct(sub["total"], sub["max"]),
                        "areas": sub["areas"], "ident_ok_pct": _pct(sub["ident_ok"], sub["areas"]),
                        "stock_ok_pct": _pct(sub["stock_ok"], sub["areas"])}
        for img, areas in imgs.items():
            for aid, t in areas.items():
                p = final.get(cam, {}).get(img, {}).get(aid)
                if p is None:
                    missing += 1
                i, s = off.score_area(p, t)
                if i + s < 2:
                    worst.append({"camera": cam, "image": img, "area": aid, "points": i + s,
                                  "predicted": None if p is None else {"compliant": bool(p["planogram_compliant"]), "stock": float(p["stock_value"])},
                                  "true": {"compliant": bool(t["planogram_compliant"]), "stock": float(t["stock_value"])}})
    worst.sort(key=lambda w: (w["points"], w["camera"], w["image"], w["area"]))
    return {
        "total": r["total"], "max": r["max"], "percent": _pct(r["total"], r["max"]),
        "ident": r["ident"], "ident_max": n, "ident_pct": _pct(r["ident"], n),
        "stock": r["stock"], "stock_max": n, "stock_pct": _pct(r["stock"], n),
        "areas": n, "ident_ok": r["ident_ok"], "ident_ok_pct": _pct(r["ident_ok"], n),
        "stock_ok": r["stock_ok"], "stock_ok_pct": _pct(r["stock_ok"], n),
        "below": r["below"], "above": r["above"], "missing": missing,
        "unlabelled": unlabelled, "worst": worst[:10], "cameras": per_cam,
        "labels_source": (d / "labels_source.txt").read_text().strip() if (d / "labels_source.txt").is_file() else "upload",
    }


@router.get("/{sid}/score")
def score(sid: str):
    d = _dir(sid)
    final = _final(d)
    if final is None:
        raise HTTPException(404, "this set has no result")
    return _score(d, final)


class Rename(BaseModel):
    name: str


@router.patch("/{sid}")
def rename(sid: str, body: Rename):
    d = _dir(sid)
    name = body.name.strip()[:80]
    if not name:
        raise HTTPException(400, "empty name")
    return _write_meta(d, name=name)


@router.delete("/{sid}")
def delete(sid: str):
    d = _dir(sid)
    if validation._s.get("session") == sid and validation._s.get("state") == "running":
        raise HTTPException(409, "this set is running")
    shutil.rmtree(d)
    return {"ok": True}
