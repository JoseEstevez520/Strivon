"""One-time setup of the label-free mode (`predict.py --label-free`). Never reads labels. Owner: -d1.

    python -I labelfree_setup.py weights
        Downloads google/siglip2-base-patch16-224 (public, ungated; pinned revision, 1.5 GB, honours HF_HOME) ONCE,
        checks its sha256, and writes the fp16 vision tower to models/compliance/deploy/siglip2b_vision_fp16.pt
        (not in git). Needs internet once, before the day; afterwards everything runs offline.

    python -I labelfree_setup.py baselines --images <folder of UNLABELLED photos> --out <baselines.json> [--planogram P]
        The "store calibration": for every planogram area, the minimum share of crate tiles that look like empty floor
        over these photos (night-curtain photos skipped). Writes <baselines.json> and <name>.sources.json (file name and
        md5 of every photo used). Use it with LABELFREE_BASELINES=<baselines.json>. predict.py --label-free refuses to
        predict any photo listed in the sources, so the baselines can never come from the photos being judged.
        Default baselines (shipped): built by -4e from our 179 unlabelled non-curtain photos.
"""
import argparse
import hashlib
import json
import os
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent
sys.path.insert(0, str(ROOT))

REPO = "google/siglip2-base-patch16-224"
REVISION = "75de2d55ec2d0b4efc50b3e9ad70dba96a7b2fa2"
SHA256 = "612923381c76ec5a9bed335d1c48827e3f2e506ac31b044b63b2031fadee6a0b"   # model.safetensors at REVISION
DEPLOY = ROOT / "models" / "compliance" / "deploy"
WEIGHTS = DEPLOY / "siglip2b_vision_fp16.pt"


def sha256(path, chunk=1 << 20):
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for b in iter(lambda: f.read(chunk), b""):
            h.update(b)
    return h.hexdigest()


def weights():
    import torch
    import transformers
    from huggingface_hub import hf_hub_download
    from transformers import SiglipVisionModel
    transformers.logging.set_verbosity_error()   # the full checkpoint's text tower is skipped on purpose
    f = hf_hub_download(REPO, "model.safetensors", revision=REVISION)
    hf_hub_download(REPO, "config.json", revision=REVISION)
    print(f"downloaded/cached: {f}")
    got = sha256(f)
    if got != SHA256:
        sys.exit(f"ERROR checksum mismatch for {f}: {got} != {SHA256}")
    print("sha256 OK")
    vm = SiglipVisionModel.from_pretrained(REPO, revision=REVISION)
    cfg = DEPLOY / "siglip2b_vision_config.json"
    if not cfg.exists():
        vm.config.to_json_file(str(cfg))
    DEPLOY.mkdir(parents=True, exist_ok=True)
    tmp = WEIGHTS.with_suffix(".tmp")
    torch.save({k: v.half() for k, v in vm.state_dict().items()}, str(tmp))
    tmp.replace(WEIGHTS)
    print(f"wrote {WEIGHTS} ({WEIGHTS.stat().st_size / 1e6:.0f} MB); label-free mode ready (offline from now on)")


def baselines(images_dir, out, planogram):
    from common import curtain_down, list_images, load_image, load_planogram
    sys.path.insert(0, str(ROOT / "models" / "labelfree"))
    if not WEIGHTS.exists():
        sys.exit(f"ERROR the label-free weights are missing: run `python -I {Path(__file__).resolve()} weights` once (internet)")
    import labelfree as LF
    pg = load_planogram(planogram)
    model = LF._model()
    model.base = {}                       # raw floor shares: no baseline subtracted
    mins, used = {}, []
    for r in list_images(images_dir, planogram):
        img = load_image(r.path)
        try:
            if curtain_down(img, r.cam)[0]:
                print(f"skip {r.cam}/{r.fname}: night curtain")
                continue
        except Exception:
            pass
        for aid, v in model.predict(img, pg[r.cam]).items():
            mins[aid] = min(mins.get(aid, 1.0), float(v["floor_share"]))
        used.append({"photo": f"{r.cam}/{r.fname}", "md5": hashlib.md5(Path(r.path).read_bytes()).hexdigest()})
    out = Path(out)
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(dict(sorted(mins.items())), indent=0), encoding="utf-8")
    out.with_name(out.stem + ".sources.json").write_text(json.dumps(
        {"built_from": str(images_dir), "labels_used": False, "photos": used}, indent=0), encoding="utf-8")
    print(f"{len(mins)} area baselines from {len(used)} photos -> {out} (+ {out.stem}.sources.json)")


def main():
    from common.paths import PLANOGRAM_PATH
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = ap.add_subparsers(dest="cmd", required=True)
    sub.add_parser("weights")
    b = sub.add_parser("baselines")
    b.add_argument("--images", required=True)
    b.add_argument("--out", required=True)
    b.add_argument("--planogram", default=str(PLANOGRAM_PATH))
    a = ap.parse_args()
    if a.cmd == "weights":
        weights()
    else:
        baselines(a.images, a.out, a.planogram)


if __name__ == "__main__":
    main()
