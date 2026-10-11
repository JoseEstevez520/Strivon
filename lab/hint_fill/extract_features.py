"""Frozen DINOv2-small features per area (CLS + patch mean of block 8, patch mean of block 4) for every photo in
data/images. Blocks 1-8 are identical to the pretrained DINOv2 in every deployed model (checked), so no label is in them.
Usage: python lab/hint_fill/extract_features.py OUT_DIR"""
import sys, os, glob, json, pathlib, numpy as np, torch
HERE = pathlib.Path(__file__).resolve().parent; REPO = HERE.parents[1]
sys.path.insert(0, str(REPO / "agents")); sys.path.insert(0, str(REPO / "agents" / "models" / "stock_4e"))
from onepass_infer import OnePass
from common import load_image, load_planogram
from predict_fill import features
out = sys.argv[1]; os.makedirs(out, exist_ok=True)
pg = load_planogram(str(REPO / "data" / "planogram.json")); m = OnePass(224, threads=8, tag="ld6ee_mix")
keys, F = [], []
for p in sorted(glob.glob(str(REPO / "data" / "images" / "*" / "*.jpg"))):
    cam, f = pathlib.Path(p).parent.name, pathlib.Path(p).name
    feats, _ = features(m, load_image(p), pg[cam])
    F.extend(feats); keys += [(cam, f, a["area_id"]) for a in pg[cam]]
np.save(out + "/F.npy", np.stack(F)); json.dump(keys, open(out + "/keys.json", "w")); print(len(keys), "areas")
