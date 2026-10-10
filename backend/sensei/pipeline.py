"""End-to-end: images -> per-area predictions (submission format + rich details for the app)."""
from __future__ import annotations

import datetime as dt
import json
from pathlib import Path

import numpy as np

from . import calibrate, clip_backend, config
from .decision import decide_compliance, decide_stock
from .extract import ImageRef, discover, extract
from .models import LabelFreeModel
from .planogram import Planogram, load_planogram


def run(
    images_dir: Path | str,
    context_dirs: list[Path | str] | None = None,
    planogram: Planogram | None = None,
    camera: str | None = None,
    use_clip: bool | None = None,
    log=print,
) -> dict:
    """Predict every planogram area of every image in `images_dir`.

    `context_dirs` are extra (unlabelled) images of the same cameras, e.g. the
    train/test sets. They are not predicted but give the label-free model more
    of the day to learn what empty and full look like for each area.
    """
    pg = planogram or load_planogram()
    targets = discover(images_dir, pg, camera)
    if not targets:
        raise SystemExit(f"no images found in {images_dir}")
    context: list[ImageRef] = []
    seen = {t.path.resolve() for t in targets}
    for d in context_dirs or []:
        for r in discover(d, pg):
            if r.path.resolve() not in seen:
                context.append(r)
                seen.add(r.path.resolve())
    log(f"{len(targets)} target images, {len(context)} context images, CLIP={'on' if (use_clip if use_clip is not None else clip_backend.available()) else 'off'}")
    feats = extract(targets + context, pg, use_clip=use_clip, log=log)
    obs = LabelFreeModel(pg, feats).run()
    cal = calibrate.load()
    if cal is not None:
        log(f"using calibrated model ({cal.get('name', 'calibration.json')})")

    submission: dict = {}
    details: dict = {}
    for ref in targets:
        for a in pg.cameras[ref.camera]:
            k = (ref.camera, ref.name, a.area_id)
            o = obs[k]
            p_stock = o.p_stock
            p_comp = o.p_compliant
            if cal is not None:
                p_stock, p_comp = calibrate.apply(cal, o, feats[k], p_stock, p_comp)
            level, value, ev = decide_stock(p_stock)
            compliant, _ = decide_compliance(p_comp)
            submission.setdefault(ref.camera, {}).setdefault(ref.name, {})[a.area_id] = {
                "planogram_compliant": bool(compliant),
                "stock_level": level,
                "stock_value": value,
            }
            details.setdefault(ref.camera, {}).setdefault(ref.name, {})[a.area_id] = {
                "planogram_compliant": bool(compliant),
                "stock_level": level,
                "stock_value": value,
                "p_stock": [round(float(x), 4) for x in p_stock],
                "expected_points": [round(float(x), 3) for x in ev],
                "p_compliant": round(float(p_comp), 4),
                "container_frac": round(float(o.container_frac), 4),
                "observed_family": o.observed_family,
                "family_probs": {f: round(v, 4) for f, v in sorted(o.family_probs.items(), key=lambda x: -x[1])[:4]},
            }
    images = {}
    for ref in targets:
        images.setdefault(ref.camera, []).append(
            {"image": ref.name, "ts": ref.ts, "local_time": ref.local_time, "path": str(ref.path)}
        )
    for v in images.values():
        v.sort(key=lambda r: (r["ts"] or 0, r["image"]))
    return {
        "submission": submission,
        "details": {
            "generated_at": dt.datetime.now().isoformat(timespec="seconds"),
            "images_dir": str(Path(images_dir).resolve()),
            "backend": ("clip:" + clip_backend.MODEL) if feats_have_clip(feats) else "heuristic",
            "calibrated": cal is not None,
            "areas": {a.area_id: a.to_json() for a in pg.areas},
            "images": images,
            "observations": details,
        },
    }


def feats_have_clip(feats) -> bool:
    f = next(iter(feats.values()), None)
    return f is not None and f.emb is not None and f.emb.size > 0


def write(result: dict, out_path: Path | str, details_path: Path | str | None = None) -> None:
    out_path = Path(out_path)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(json.dumps(result["submission"], indent=1, ensure_ascii=False), encoding="utf-8")
    if details_path:
        Path(details_path).write_text(json.dumps(result["details"], ensure_ascii=False), encoding="utf-8")


def validate_submission(sub: dict, pg: Planogram) -> list[str]:
    """Sanity checks so we never lose points to a formatting slip."""
    problems = []
    for cam, imgs in sub.items():
        if cam not in pg.cameras:
            problems.append(f"unknown camera {cam}")
            continue
        expected = {a.area_id for a in pg.cameras[cam]}
        for img, areas in imgs.items():
            missing = expected - set(areas)
            if missing:
                problems.append(f"{cam}/{img}: missing {sorted(missing)}")
            for aid, v in areas.items():
                if v.get("stock_level") not in config.STOCK_LEVELS:
                    problems.append(f"{cam}/{img}/{aid}: bad stock_level {v.get('stock_level')}")
                elif not np.isclose(config.STOCK_LEVELS[v["stock_level"]], v.get("stock_value", -1)):
                    problems.append(f"{cam}/{img}/{aid}: stock_value does not match stock_level")
                if not isinstance(v.get("planogram_compliant"), bool):
                    problems.append(f"{cam}/{img}/{aid}: planogram_compliant must be bool")
    return problems
