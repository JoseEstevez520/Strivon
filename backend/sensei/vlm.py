"""Optional: Claude vision as a *teacher* (needs ANTHROPIC_API_KEY or `ant auth login`).

For each image we send the camera frame with the numbered planogram areas
drawn on it plus a mosaic of the rectified areas, and ask Claude for the stock
level and whether the visible product matches the planogram.

The output is written in the annotation format, so it can be used to
  * calibrate the label-free model without human labels:
        python -m sensei calibrate --annotations outputs/vlm_labels.json
  * or be compared with the team's annotations:
        python -m sensei score --pred outputs/vlm_labels.json --gt eval/labels.json
"""
from __future__ import annotations

import base64
import json
from pathlib import Path

import cv2
import numpy as np

from . import config
from .extract import crops_for, discover
from .planogram import load_planogram

MODEL = "claude-opus-5-5"

SCHEMA = {
    "type": "object",
    "properties": {
        "areas": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "area": {"type": "integer"},
                    "visible_product": {"type": "string"},
                    "matches_planogram": {"type": "boolean"},
                    "stock_level": {"type": "string", "enum": ["empty", "half", "full"]},
                    "confidence": {"type": "number"},
                },
                "required": ["area", "visible_product", "matches_planogram", "stock_level", "confidence"],
                "additionalProperties": False,
            },
        }
    },
    "required": ["areas"],
    "additionalProperties": False,
}

INSTRUCTIONS = """You are checking fruit & vegetable gondolas in a supermarket from a ceiling camera.
Image 1 is the camera frame with numbered planogram areas outlined. Image 2 shows each area rectified, labelled with its number.

For every area listed below, report:
- visible_product: what is actually in the area (generic name, e.g. "bananas", "bags of oranges", "nothing").
- matches_planogram: true if the product shown is the one the planogram expects (variety differences that cannot be seen from the ceiling count as a match). An empty area counts as true.
- stock_level: round DOWN. "empty" = it needs restocking now (nothing, or only one or two units left); "full" only if the area is completely full (one unit missing is already "half"); everything in between is "half".
- confidence: 0-1.

Staff use this to decide what to restock, so when unsure between two stock levels choose the lower one.

Areas (number: expected product):
"""


def _encode(img: np.ndarray, quality: int = 85) -> str:
    ok, buf = cv2.imencode(".jpg", img, [cv2.IMWRITE_JPEG_QUALITY, quality])
    return base64.standard_b64encode(buf.tobytes()).decode()


def _overlay(path: Path, areas) -> np.ndarray:
    im = cv2.imread(str(path))
    for a in areas:
        pts = a.quad.astype(np.int32)
        cv2.polylines(im, [pts], True, (0, 255, 255), 2)
        cx, cy = pts.mean(0).astype(int)
        cv2.putText(im, str(a.index), (cx - 12, cy + 10), cv2.FONT_HERSHEY_SIMPLEX, 1.0, (0, 0, 0), 5)
        cv2.putText(im, str(a.index), (cx - 12, cy + 10), cv2.FONT_HERSHEY_SIMPLEX, 1.0, (255, 255, 255), 2)
    return im


def _mosaic(crops, areas, cols: int = 4) -> np.ndarray:
    tiles = []
    for c, a in zip(crops, areas):
        t = cv2.resize(c, (256, 192))
        cv2.rectangle(t, (0, 0), (44, 30), (0, 0, 0), -1)
        cv2.putText(t, str(a.index), (4, 24), cv2.FONT_HERSHEY_SIMPLEX, 0.8, (255, 255, 255), 2)
        tiles.append(t)
    while len(tiles) % cols:
        tiles.append(np.zeros_like(tiles[0]))
    rows = [np.hstack(tiles[i : i + cols]) for i in range(0, len(tiles), cols)]
    return np.vstack(rows)


def label_image(client, ref, pg) -> dict:
    areas = pg.cameras[ref.camera]
    _, crops, _ = crops_for(ref, pg)
    listing = "\n".join(f"{a.index}: {a.product_name} ({a.info.prompt_noun})" for a in areas)
    resp = client.beta.messages.create(
        model=MODEL,
        max_tokens=16000,
        betas=["server-side-fallback-2026-07-01"],
        fallbacks="default",
        output_config={"effort": "medium", "format": {"type": "json_schema", "schema": SCHEMA}},
        messages=[{
            "role": "user",
            "content": [
                {"type": "image", "source": {"type": "base64", "media_type": "image/jpeg", "data": _encode(_overlay(ref.path, areas))}},
                {"type": "image", "source": {"type": "base64", "media_type": "image/jpeg", "data": _encode(_mosaic(crops, areas))}},
                {"type": "text", "text": INSTRUCTIONS + listing},
            ],
        }],
    )
    if resp.stop_reason == "refusal":
        raise RuntimeError(f"refused: {resp.stop_details}")
    text = next(b.text for b in resp.content if b.type == "text")
    by_idx = {r["area"]: r for r in json.loads(text)["areas"]}
    out = {}
    for a in areas:
        r = by_idx.get(a.index)
        if r is None:
            continue
        out[a.area_id] = {
            "planogram_compliant": bool(r["matches_planogram"]),
            "stock_level": r["stock_level"],
            "stock_value": config.STOCK_LEVELS[r["stock_level"]],
            "visible_product": r["visible_product"],
            "confidence": r["confidence"],
        }
    return out


def run(images_dir: Path | str, out_path: Path | str, camera: str | None = None, log=print) -> dict:
    import anthropic

    try:
        from dotenv import load_dotenv

        load_dotenv(config.ROOT / ".env")
    except ImportError:
        pass
    client = anthropic.Anthropic()
    pg = load_planogram()
    refs = discover(images_dir, pg, camera)
    out_path = Path(out_path)
    result = json.loads(out_path.read_text(encoding="utf-8")) if out_path.exists() else {}
    for i, ref in enumerate(refs):
        if ref.name in result.get(ref.camera, {}):
            continue  # resume
        try:
            result.setdefault(ref.camera, {})[ref.name] = label_image(client, ref, pg)
        except anthropic.APIStatusError as e:
            log(f"  {ref.camera}/{ref.name}: API error {e.status_code}: {e.message}")
            continue
        except Exception as e:  # noqa: BLE001
            log(f"  {ref.camera}/{ref.name}: {e}")
            continue
        out_path.parent.mkdir(parents=True, exist_ok=True)
        out_path.write_text(json.dumps(result, indent=1, ensure_ascii=False), encoding="utf-8")
        log(f"  {i + 1}/{len(refs)} {ref.camera}/{ref.name}")
    return result
