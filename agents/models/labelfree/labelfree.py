"""predict.py adapter for -4e's label-free model (models/compliance/labelfree_infer.py, candidate U2), used by
`predict.py --label-free`. Owner: -d1.

Zero labels. Product: SigLIP2-base zero-shot over the camera's product families (+ EMPTY). Stock: share of crate
tiles that look like empty crate floor, minus a per-area baseline (the area's minimum share over a set of UNLABELLED
photos of the store, built once by labelfree_setup.py). predict.py asks for stock and compliance separately and
loads this file once per role, so the model and the answers for the current photo are shared through one registry.

Baselines: env LABELFREE_BASELINES = a .json written by labelfree_setup.py (next to it, <name>.sources.json lists the
photos it was built from); default = -4e's shipped models/compliance/deploy/labelfree_baselines.json (built from our
179 unlabelled non-curtain photos; sources listed in models/labelfree/deploy/shipped_baselines.sources.json).
Vision weights: models/compliance/deploy/siglip2b_vision_fp16.pt, written by `labelfree_setup.py weights` (not in git),
or env LABELFREE_WEIGHTS = another copy of that file (read-only use, nothing is written).
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


def weights_file():
    return Path(os.environ.get("LABELFREE_WEIGHTS") or DEPLOY / "siglip2b_vision_fp16.pt")


def _model():
    if _S.model is None:
        import torch
        from labelfree_infer import LabelFree
        real, w = torch.load, weights_file()

        def load(f, *args, **kw):  # LabelFree reads deploy/siglip2b_vision_fp16.pt; LABELFREE_WEIGHTS points elsewhere
            return real(str(w) if str(f).endswith("siglip2b_vision_fp16.pt") else f, *args, **kw)
        torch.load = load
        try:
            _S.model = LabelFree(device=os.environ.get("LABELFREE_DEVICE", "cpu"),
                                 threads=int(os.environ.get("LABELFREE_THREADS", "4")))
        finally:
            torch.load = real
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
