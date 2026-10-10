"""Seconds per photo for the submission path (cold features, no cache).

Run from backend/:  python timing.py [n_photos]
"""
import os
import shutil
import sys
import tempfile
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from sensei import config  # noqa: E402
from sensei.extract import discover, extract  # noqa: E402
from sensei.planogram import load_planogram  # noqa: E402

n = int(sys.argv[1]) if len(sys.argv) > 1 else 14
pg = load_planogram()
refs = discover(config.IMAGES_DIR, pg)
pick = refs[:: max(1, len(refs) // n)][:n]
tmp = Path(tempfile.mkdtemp())
for r in pick:
    (tmp / r.camera).mkdir(exist_ok=True)
    shutil.copy(r.path, tmp / r.camera / r.name)
config.CACHE_DIR = tmp / "cache"  # cold run
trefs = discover(tmp, pg)
extract(trefs[:1], pg, log=None)  # load the model once, as on the day
t0 = time.time()
feats = extract(trefs[1:], pg, log=None, crates=getattr(__import__("sensei.single").single.load(), "crates", False))
t_clip = (time.time() - t0) / (len(trefs) - 1)
from sensei.occlusion import person_boxes  # noqa: E402

person_boxes(trefs[0].path)
t0 = time.time()
for r in trefs[1:]:
    person_boxes(r.path)
t_person = (time.time() - t0) / (len(trefs) - 1)
from sensei import single  # noqa: E402

m = single.load()
t0 = time.time()
if m is not None:
    single.predict(m, pg, sorted(feats), feats)
t_model = (time.time() - t0) / (len(trefs) - 1)
print(f"CPU threads: {os.cpu_count()}")
print(f"features (crops + CLIP {__import__('sensei.clip_backend').clip_backend.MODEL}): {t_clip:.2f} s/photo")
print(f"person detector: {t_person:.2f} s/photo")
print(f"model + decision: {t_model:.3f} s/photo")
print(f"total: {t_clip + t_person + t_model:.2f} s/photo")
shutil.rmtree(tmp, ignore_errors=True)
