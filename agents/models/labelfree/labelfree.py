"""predict.py adapter for -4e's label-free model (models/compliance/labelfree_infer.py, candidate U2), used by
`predict.py --label-free`. Owner: -d1.

Zero labels. Product: SigLIP2-base zero-shot over the camera's product families (+ EMPTY). Stock: share of crate
tiles that look like empty crate floor, minus a per-area baseline (the area's minimum share over a set of UNLABELLED
photos of the store, built once by labelfree_setup.py). predict.py asks for stock and compliance separately and
loads this file once per role, so the model and the answers for the current photo are shared through one registry.

Baselines: env LABELFREE_BASELINES = a .json written by labelfree_setup.py (next to it, <name>.sources.json lists the
photos it was built from); default = -4e's shipped models/compliance/deploy/labelfree_baselines.json (built from our
179 unlabelled non-curtain photos; sources listed in models/labelfree/deploy/shipped_baselines.sources.json).
If the 186 MB vision weights ship as shards (siglip2b_vision_fp16.part*.pt), they are merged once on first use.
Env: LABELFREE_DEVICE (cpu or cuda, default cpu), LABELFREE_THREADS (default 4).
"""
import hashlib
import json
import os
import sys
import types
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
HERE = Path(__file__).resolve().parent
DEPLOY = ROOT / "models" / "compliance" / "deploy"
sys.path.insert(0, str(ROOT / "models" / "compliance"))

_S = sys.modules.setdefault("_labelfree_shared", types.SimpleNamespace(model=None, key=None, answers=None))


def baselines_files():
    """(baselines .json, its sources .json) in use."""
    custom = os.environ.get("LABELFREE_BASELINES")
    if custom:
        b = Path(custom)
        return b, b.with_name(b.stem + ".sources.json")
    return DEPLOY / "labelfree_baselines.json", HERE / "deploy" / "shipped_baselines.sources.json"


def _merge_shards():
    """Rebuild deploy/siglip2b_vision_fp16.pt from its <100 MB shards (GitHub's file limit), once."""
    import torch
    full = DEPLOY / "siglip2b_vision_fp16.pt"
    parts = sorted(DEPLOY.glob("siglip2b_vision_fp16.part*.pt"))
    if full.exists() or not parts:
        return
    sd = {}
    for p in parts:
        sd.update(torch.load(str(p), map_location="cpu"))
    tmp = full.with_suffix(".tmp")
    torch.save(sd, str(tmp))
    tmp.replace(full)
    print(f"WARN  merged {len(parts)} weight shards into {full.name} (first label-free run)")


def _model():
    if _S.model is None:
        _merge_shards()
        from labelfree_infer import LabelFree
        _S.model = LabelFree(device=os.environ.get("LABELFREE_DEVICE", "cpu"),
                             threads=int(os.environ.get("LABELFREE_THREADS", "4")))
        b, _ = baselines_files()
        _S.model.base = json.loads(b.read_text(encoding="utf-8"))
    return _S.model


def prepare(images=None, context=False):
    _model()


def _answers(img, cam, areas):
    key = (cam, tuple(a["area_id"] for a in areas), hashlib.md5(img.tobytes()).hexdigest())
    if _S.key != key:
        _S.key, _S.answers = key, _model().predict(img, areas)
    return _S.answers


def predict_stock_image(img, cam, areas, ts=None, context=False):
    """{area_id: {0: p_empty, 0.5: p_half, 1: p_full}} (one-hot: the label-free rule gives a level, not probabilities)."""
    return {aid: dict(zip((0, 0.5, 1), r["p_stock"])) for aid, r in _answers(img, cam, areas).items()}


def predict_compliant_image(img, cam, areas, ts=None, context=False):
    return {aid: r["compliant"] for aid, r in _answers(img, cam, areas).items()}
