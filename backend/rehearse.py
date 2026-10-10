"""Dress rehearsal of validation day.

Hides 2 random photos per camera (about the size of the hidden validation set), trains the
supervised model without their labels, runs the real submission command on them and scores the
result with eval/score.py.

Run from backend/:  python rehearse.py [--seed 1] [--per-camera 2]
"""
import argparse
import json
import os
import random
import shutil
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
ap = argparse.ArgumentParser()
ap.add_argument("--seed", type=int, default=1)
ap.add_argument("--per-camera", type=int, default=2)
args = ap.parse_args()

work = ROOT / "outputs" / f"rehearsal_seed{args.seed}"
val = work / "validation"
shutil.rmtree(work, ignore_errors=True)
val.mkdir(parents=True)
labels = json.loads((ROOT / "eval" / "labels.json").read_text(encoding="utf-8"))
rng = random.Random(args.seed)
hold, gt = {}, {}
for cam_dir in sorted((ROOT / "data" / "images").iterdir()):
    imgs = sorted(p.name for p in cam_dir.glob("*.jpg"))
    pick = rng.sample(imgs, args.per_camera)
    hold[cam_dir.name] = pick
    (val / cam_dir.name).mkdir()
    for name in pick:
        shutil.copy(cam_dir / name, val / cam_dir.name / name)
        gt.setdefault(cam_dir.name, {})[name] = labels[cam_dir.name][name]
(work / "holdout.json").write_text(json.dumps(hold))
(work / "gt.json").write_text(json.dumps(gt, indent=1))

env = dict(os.environ, SENSEI_HOLDOUT=str(work / "holdout.json"), SENSEI_MODEL=str(work / "model.pkl"))
py = sys.executable
subprocess.run([py, "-m", "sensei", "train"], env=env, check=True, cwd=ROOT / "backend")
subprocess.run([py, "-m", "sensei", "predict", "--images", str(val), "--context", str(ROOT / "data" / "images"),
                "--out", str(work / "predictions.json"), "--details", str(work / "details.json")],
               env=env, check=True, cwd=ROOT / "backend")
subprocess.run([py, str(ROOT / "eval" / "score.py"), str(work / "predictions.json"), str(work / "gt.json")], check=True)
