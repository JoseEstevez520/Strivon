"""Shared data layer for the Sensei challenge (owner: -d1). See common/README.md."""
from . import submission
from .crops import bbox, bbox_crop, native_size, polygon_mask, quad, rectify, rectify_mask, visible_fraction
from .data import (CURTAIN_PHOTOS, IMAGE_SIZE, LISBON, OVERLAP_PAIRS, ImageRec, area_cam, areas_by_id,
                   curtain_down, identify_camera, list_images, load_image, load_planogram, neighbors)
from .paths import CACHE_DIR, DATASET_DIR, IMAGES_DIR, PLANOGRAM_PATH, PROJECT_DIR
