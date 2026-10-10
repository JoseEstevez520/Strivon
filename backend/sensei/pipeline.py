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
    use_supervised: bool = True,
    use_occlusion: bool = False,
    model: str = "auto",
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
    from . import single, supervised

    # Default: the single-image model. Sensei asked us to use only the image under analysis, so
    # with it no other photo is read (no context, no neighbours).
    single_model = single.load() if model in ("auto", "single") else None
    if model == "single" and single_model is None:
        raise SystemExit("outputs/single.pkl not found: run `python -m sensei train-single` first")
    if single_model is not None:
        context_dirs = []
    context: list[ImageRef] = []
    seen = {t.path.resolve() for t in targets}
    for d in context_dirs or []:
        for r in discover(d, pg):
            if r.path.resolve() not in seen:
                context.append(r)
                seen.add(r.path.resolve())
    log(f"{len(targets)} target images, {len(context)} context images, CLIP={'on' if (use_clip if use_clip is not None else clip_backend.available()) else 'off'}")
    use_crates = bool(single_model is not None and getattr(single_model, "crates", False))
    feats = extract(targets + context, pg, use_clip=use_clip, log=log, crates=use_crates)
    obs = LabelFreeModel(pg, feats).run()  # label-free signals, only shown in the app's "why" panel
    cal = calibrate.load()
    sup = None
    occluded_cover: dict = {}
    tkeys = [(r.camera, r.name, a.area_id) for r in targets for a in pg.cameras[r.camera]]

    if single_model is not None:
        sup, _ = single.predict(single_model, pg, tkeys, feats)  # crate crops when the model uses them
        cal = None
        log("using the single-image model (only the photo under analysis)")
        if use_occlusion:
            # A person in front of the area: the photo shows little of the shelf, so use what the
            # model learned for that area in general (its training prior), rounded down.
            from .occlusion import COVER_MIN, covered_fraction, person_boxes

            n_occ = 0
            for r in targets:
                boxes = person_boxes(r.path)
                for a in pg.cameras[r.camera] if boxes else []:
                    k = (r.camera, r.name, a.area_id)
                    occluded_cover[k] = covered_fraction(a.quad, boxes)
                    prior = single_model.area_prior.get(a.area_id) if hasattr(single_model, "area_prior") else None
                    if occluded_cover[k] >= COVER_MIN and prior is not None:
                        sup[k] = prior
                        n_occ += 1
            if n_occ:
                log(f"{n_occ} areas covered by a person: used the area's learned prior")
    elif model in ("auto", "neighbours") and use_supervised and supervised.load() is not None:
        # Uses the labelled photos taken before/after: NOT allowed for the submission (Sensei),
        # kept only to compare on the leaderboard.
        sup_model = supervised.load()
        ts = {(r.camera, r.name): r.ts for r in targets + context}
        sup = supervised.predict(sup_model, tkeys, feats, obs, ts)
        log("WARNING: neighbour model (uses other photos), not allowed for the submission")
        cal = None
    elif cal is not None:
        log(f"using calibrated model ({cal.get('name', 'calibration.json')})")

    submission: dict = {}
    details: dict = {}
    for ref in targets:
        for a in pg.cameras[ref.camera]:
            k = (ref.camera, ref.name, a.area_id)
            o = obs[k]
            p_stock = o.p_stock
            p_comp = o.p_compliant
            if sup is not None:
                p_stock, p_comp = sup[k]
            elif cal is not None:
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
                "person_cover": round(float(occluded_cover.get(k, 0.0)), 3),
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
            "calibrated": cal is not None or sup is not None,
            "model": ("single-image" if single_model is not None else "neighbours") if sup is not None else ("calibrated" if cal is not None else "label-free"),
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
