from __future__ import annotations

import os
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DATA_DIR = Path(os.environ.get("SENSEI_DATA", ROOT / "data"))
IMAGES_DIR = Path(os.environ.get("SENSEI_IMAGES", DATA_DIR / "images"))
PLANOGRAM_PATH = Path(os.environ.get("SENSEI_PLANOGRAM", DATA_DIR / "planogram.json"))
OUTPUTS_DIR = ROOT / "outputs"
CACHE_DIR = ROOT / "outputs" / "cache"
ANNOTATIONS_DIR = ROOT / "annotations"

SECTION = "Frutas e Legumes"
IMAGE_SIZE = (1280, 720)  # (w, h)
# Rectified crop size used for every planogram area (w, h).
CROP_SIZE = (192, 144)
# Store local time offset from UTC for the dataset day (Portugal, summer time).
TZ_OFFSET_HOURS = 1

STOCK_LEVELS = {"empty": 0.0, "half": 0.5, "full": 1.0}
LEVEL_NAMES = ["empty", "half", "full"]

# Scoring rules from the challenge brief.
SCORE_ID_CORRECT, SCORE_ID_WRONG = 1, -2
SCORE_STOCK_CORRECT, SCORE_STOCK_BELOW, SCORE_STOCK_ABOVE = 1, -2, -3
