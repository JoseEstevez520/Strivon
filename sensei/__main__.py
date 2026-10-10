"""Command line entry point.

  python -m sensei predict  --images <dir> [--context data/images] [--out outputs/submission.json]
  python -m sensei score    --pred outputs/submission.json --gt annotations/team.json
  python -m sensei calibrate --annotations annotations/team.json
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
    p.add_argument("--out", default=str(config.OUTPUTS_DIR / "submission.json"))
    p.add_argument("--details", default=str(config.OUTPUTS_DIR / "details.json"))
    p.add_argument("--no-clip", action="store_true", help="classical features only (fast, no PyTorch)")

    s = sub.add_parser("score", help="score a submission against annotations (challenge rules)")
    s.add_argument("--pred", default=str(config.OUTPUTS_DIR / "submission.json"))
    s.add_argument("--gt", nargs="+", required=True)

    c = sub.add_parser("calibrate", help="fit a small model on team annotations (optional)")
    c.add_argument("--annotations", nargs="+", default=None)

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
        res = run(a.images, ctx, camera=a.camera, use_clip=False if a.no_clip else None)
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

        paths = [Path(x) for x in a.annotations] if a.annotations else sorted(config.ANNOTATIONS_DIR.glob("*.json"))
        if not paths:
            print("no annotation files found in annotations/")
            return 1
        fit(paths)
        return 0

    if a.cmd == "vlm-label":
        from .vlm import run as vlm_run

        vlm_run(a.images, a.out, camera=a.camera)
        print(f"wrote {a.out}")
        return 0

    if a.cmd == "serve":
        import uvicorn

        uvicorn.run("app.server:app", host=a.host, port=a.port, reload=False)
        return 0
    return 1


if __name__ == "__main__":
    sys.exit(main())
