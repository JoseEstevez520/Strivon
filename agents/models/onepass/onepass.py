"""predict.py adapter for -4e's one-pass image-only model (models/stock_4e/onepass_infer.py). Owner: -d1.

One DINOv2-S pass per photo gives both answers (product and stock), using only the image under analysis.
predict.py asks for stock and compliance separately and loads this file once per role, so the model and the
answers for the current photo are shared through one registry (keyed by camera, areas and a hash of the pixels).

    py -I predict.py --images <folder of <camera>/<timestamp>.jpg> --planogram <planogram.json> \
        --stock-model models/onepass/onepass.py --compliance-model models/onepass/onepass.py --out preds.json

Env: ONEPASS_SIZE (default 224), ONEPASS_TAG (default ld6ee = weights retrained on the final team labels @d6eeba4,
round-2 recipe R3), ONEPASS_DEVICE (cpu or cuda, default cpu), ONEPASS_THREADS (default 4), ONEPASS_B8_HEAD: the free
block-8 stock head that OnePass averages 1:1 with its fine-tuned p_stock in the same pass. Unset = the tag's own head
models/onepass/deploy/stockb8_<ONEPASS_TAG>.npz if that file exists (e.g. ld6ee_mix), else models/onepass/deploy/
stockb8.npz if that exists (ld6ee's), "off" = never, or a path to another .npz. predict.py --stock-model mix sets
ONEPASS_TAG and ONEPASS_B8_HEAD together.
"""
import hashlib
import os
import sys
import types
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "models" / "stock_4e"))
from onepass_infer import OnePass  # noqa: E402

_S = sys.modules.setdefault("_onepass_shared", types.SimpleNamespace(model=None, key=None, answers=None))


def _b8_head():
    head = os.environ.get("ONEPASS_B8_HEAD")
    if head is None:  # the tag's own head first (stockb8_ld6ee_mix.npz for ld6ee_mix), then ld6ee's stockb8.npz
        deploy = Path(__file__).resolve().parent / "deploy"
        own = deploy / f"stockb8_{os.environ.get('ONEPASS_TAG', 'ld6ee')}.npz"
        default = own if own.exists() else deploy / "stockb8.npz"
        head = str(default) if default.exists() else "off"
    return None if head == "off" else head


def _model():
    if _S.model is None:
        _S.model = OnePass(size=int(os.environ.get("ONEPASS_SIZE", "224")),
                           device=os.environ.get("ONEPASS_DEVICE", "cpu"),
                           threads=int(os.environ.get("ONEPASS_THREADS", "4")),
                           tag=os.environ.get("ONEPASS_TAG", "ld6ee"),
                           b8_stock=_b8_head())
    return _S.model


def prepare(images=None, context=False):
    _model()


def _answers(img, cam, areas):
    key = (cam, tuple(a["area_id"] for a in areas), hashlib.md5(img.tobytes()).hexdigest())
    if _S.key != key:
        _S.key, _S.answers = key, _model().predict(img, areas)
    return _S.answers


def predict_stock_image(img, cam, areas, ts=None, context=False):
    """{area_id: {0: p_empty, 0.5: p_half, 1: p_full}}; predict.py picks the best-expected-points level."""
    return {aid: dict(zip((0, 0.5, 1), r["p_stock"])) for aid, r in _answers(img, cam, areas).items()}


def predict_compliant_image(img, cam, areas, ts=None, context=False):
    return {aid: r["compliant"] for aid, r in _answers(img, cam, areas).items()}
