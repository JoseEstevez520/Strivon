"""Where things live. Point SENSEI_DATASET at another copy of the dataset folder to override."""
import os
from pathlib import Path

PROJECT_DIR = Path(__file__).resolve().parent.parent
DATASET_DIR = Path(os.environ.get(
    "SENSEI_DATASET",
    PROJECT_DIR / "OfficialDataset" / "new_dataset_hackathon_junctionx_10_oct_2026_v2"))
IMAGES_DIR = DATASET_DIR / "Frutas e Legumes (train & test)"
PLANOGRAM_PATH = DATASET_DIR / "planogram.json"
CACHE_DIR = PROJECT_DIR / "cache"
