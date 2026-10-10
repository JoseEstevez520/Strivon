"""Command line entry point.

  python -m sensei predict  --images <dir> [--context data/images] [--out outputs/predictions.json]
  python -m sensei score    --pred outputs/predictions.json --gt eval/labels.json
  python -m sensei calibrate --annotations eval/labels.json
  python -m sensei vlm-label [--images <dir>]      (optional, needs ANTHROPIC_API_KEY)
  python -m sensei serve    [--port 8000]
"""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

from . import config


def main(argv=None) -> int:
    ap = argparse.ArgumentParser(prog="sensei")
    sub = ap.add_subparsers(dest="cmd", required=True)

    p = sub.add_parser("predict", help="predict every planogram area of every image")
    p.add_argument("--images", default=str(config.IMAGES_DIR), help="folder with <camera>/<timestamp>.jpg")
    p.add_argument("--context", nargs="*", default=None,
                   help="extra unlabelled image folders of the same cameras (default: data/images)")
    p.add_argument("--camera", help="camera id if --images is a flat folder of one camera")
    p.add_argument("--out", default=str(config.PREDICTIONS_PATH))
    p.add_argument("--details", default=str(config.OUTPUTS_DIR / "details.json"))
    p.add_argument("--no-clip", action="store_true", help="classical features only (fast, no PyTorch)")
    p.add_argument("--label-free", action="store_true", help="ignore the supervised model (outputs/supervised.pkl)")

    s = sub.add_parser("score", help="score a submission against annotations (challenge rules)")
    s.add_argument("--pred", default=str(config.PREDICTIONS_PATH))
    s.add_argument("--gt", nargs="+", default=[str(config.LABELS_PATH)])

    c = sub.add_parser("calibrate", help="fit a small model on team labels (optional)")
    c.add_argument("--annotations", nargs="+", default=None)

    t = sub.add_parser("train", help="train the supervised model on eval/labels.json (+ André's checks), with photo-held-out CV")
    t.add_argument("--ctx", action="store_true", help="add whole-crate crop features (tested: no gain, 488 vs 489)")

    m = sub.add_parser("vlm-label", help="(optional) label images with Claude vision; needs ANTHROPIC_API_KEY")
    m.add_argument("--images", default=str(config.IMAGES_DIR))
    m.add_argument("--camera")
    m.add_argument("--out", default=str(config.OUTPUTS_DIR / "vlm_labels.json"))

    v = sub.add_parser("serve", help="run the staff dashboard")
    v.add_argument("--host", default="127.0.0.1")
    v.add_argument("--port", type=int, default=8000)

    a = ap.parse_args(argv)

    if a.cmd == "predict":
        from .pipeline import run, validate_submission, write
        from .planogram import load_planogram

        ctx = a.context if a.context is not None else [str(config.IMAGES_DIR)]
        res = run(a.images, ctx, camera=a.camera, use_clip=False if a.no_clip else None, use_supervised=not a.label_free)
        problems = validate_submission(res["submission"], load_planogram())
        write(res, a.out, a.details)
        n = sum(len(x) for imgs in res["submission"].values() for x in imgs.values())
        print(f"wrote {a.out} ({n} areas) and {a.details}")
        if problems:
            print("VALIDATION PROBLEMS:\n  " + "\n  ".join(problems[:20]))
            return 1
        return 0

    if a.cmd == "score":
        from .calibrate import load_annotations
        from .scoring import score

        rep = score(json.loads(Path(a.pred).read_text(encoding="utf-8")), load_annotations([Path(x) for x in a.gt]))
        print(rep)
        return 0

    if a.cmd == "calibrate":
        from .calibrate import fit

        paths = [Path(x) for x in a.annotations] if a.annotations else [p for p in [config.LABELS_PATH] if p.exists()]
        if not paths:
            print("no labels found in eval/labels.json")
            return 1
        fit(paths)
        return 0

    if a.cmd == "train":
        from .supervised import train

        train(use_ctx=a.ctx)
        return 0

    if a.cmd == "vlm-label":
        from .vlm import run as vlm_run

        vlm_run(a.images, a.out, camera=a.camera)
        print(f"wrote {a.out}")
        return 0

    if a.cmd == "serve":
        import uvicorn

        import sys as _s
        _s.path.insert(0, str(Path(__file__).resolve().parents[1]))
        uvicorn.run("app.server:app", host=a.host, port=a.port, reload=False)
        return 0
    return 1


if __name__ == "__main__":
    sys.exit(main())
