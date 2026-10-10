"""Check a submission JSON before handing it in.

    py -I submission/validate.py preds/x.json --images "<folder with the images it should cover>" [--planogram P]

Exit code 0 = no errors. Without --images only the format is checked (not completeness).
"""
import argparse
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from common import list_images, submission  # noqa: E402
from common.paths import PLANOGRAM_PATH  # noqa: E402


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("pred")
    ap.add_argument("--images", help="image folder the submission must fully cover")
    ap.add_argument("--planogram", default=str(PLANOGRAM_PATH))
    args = ap.parse_args()

    sub = submission.read(args.pred)
    images = list_images(args.images, args.planogram) if args.images else None
    errors, warnings = submission.validate(sub, images, args.planogram)
    n_areas = sum(len(a) for imgs in sub.values() for a in imgs.values())
    n_imgs = sum(len(imgs) for imgs in sub.values())
    for w in warnings:
        print("WARN ", w)
    for e in errors[:50]:
        print("ERROR", e)
    if len(errors) > 50:
        print(f"... and {len(errors) - 50} more errors")
    print(f"{args.pred}: {n_imgs} images, {n_areas} areas, {len(errors)} errors, {len(warnings)} warnings"
          + (f" (expected {sum(len(v) for v in submission.expected_areas(images, args.planogram).values())} areas)"
             if images else ""))
    sys.exit(1 if errors else 0)


if __name__ == "__main__":
    main()
