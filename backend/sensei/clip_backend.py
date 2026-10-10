"""Optional zero-shot backend based on OpenCLIP (runs on CPU).

Enabled automatically when `torch` and `open_clip` are installed. The model
is configurable through SENSEI_CLIP_MODEL / SENSEI_CLIP_PRETRAINED.
"""
from __future__ import annotations

import os
from functools import lru_cache

import cv2
import numpy as np

MODEL = os.environ.get("SENSEI_CLIP_MODEL", "ViT-B-16")
PRETRAINED = os.environ.get("SENSEI_CLIP_PRETRAINED", "laion2b_s34b_b88k")


def available() -> bool:
    try:
        import open_clip  # noqa: F401
        import torch  # noqa: F401
    except Exception:
        return False
    return os.environ.get("SENSEI_DISABLE_CLIP", "") == ""


@lru_cache(maxsize=1)
def _model():
    import open_clip
    import torch

    torch.set_num_threads(max(1, (os.cpu_count() or 4) - 2))
    model, _, preprocess = open_clip.create_model_and_transforms(MODEL, pretrained=PRETRAINED)
    model.eval()
    tokenizer = open_clip.get_tokenizer(MODEL)
    return model, preprocess, tokenizer


def embed_images(crops_bgr: list[np.ndarray], batch: int = 64) -> np.ndarray:
    import torch
    from PIL import Image

    model, preprocess, _ = _model()
    out = []
    with torch.no_grad():
        for i in range(0, len(crops_bgr), batch):
            ims = [preprocess(Image.fromarray(cv2.cvtColor(c, cv2.COLOR_BGR2RGB))) for c in crops_bgr[i : i + batch]]
            f = model.encode_image(torch.stack(ims))
            out.append(torch.nn.functional.normalize(f, dim=-1).numpy())
    return np.concatenate(out) if out else np.zeros((0, 512), np.float32)


@lru_cache(maxsize=4096)
def _embed_text_cached(text: str) -> np.ndarray:
    import torch

    model, _, tok = _model()
    with torch.no_grad():
        f = model.encode_text(tok([text]))
        return torch.nn.functional.normalize(f, dim=-1).numpy()[0]


def embed_texts(texts: list[str]) -> np.ndarray:
    return np.stack([_embed_text_cached(t) for t in texts])


def logit_scale() -> float:
    model, _, _ = _model()
    return float(model.logit_scale.exp().item())


def softmax(x: np.ndarray, axis: int = -1) -> np.ndarray:
    x = x - x.max(axis=axis, keepdims=True)
    e = np.exp(x)
    return e / e.sum(axis=axis, keepdims=True)


# --- prompt sets -----------------------------------------------------------------

EMPTY_PROMPTS = [
    "a photo of an empty supermarket display crate",
    "a photo of an empty black supermarket shelf",
    "a photo of an empty wicker basket on a shelf",
    "a photo of an empty cardboard tray",
    "a top-down photo of an empty produce bin with nothing in it",
]


def stock_prompts(noun: str) -> dict[str, list[str]]:
    return {
        "empty": EMPTY_PROMPTS,
        "half": [
            f"a photo of a display crate half full of {noun}, with a lot of empty space",
            f"a photo of a few {noun} left on an almost empty shelf",
            f"a top-down photo of a produce bin with only some {noun}",
        ],
        "full": [
            f"a photo of a display crate completely full of {noun}",
            f"a top-down photo of a produce bin piled high with {noun}",
            f"a photo of a fully stocked shelf of {noun}",
        ],
    }


def family_prompts(description: str, packaged: bool) -> list[str]:
    base = [f"a photo of {description}", f"a top-down photo of {description} in a supermarket"]
    if packaged:
        base.append(f"a photo of plastic packages of {description}")
    return base
