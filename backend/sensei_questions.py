"""Build docs/sensei_questions.jpg: real borderline cases to show the Sensei mentors.

Each tile shows the full camera frame with one area outlined, plus the rectified area, and the
question. Run from backend/:  python sensei_questions.py
"""
import json
import subprocess
from pathlib import Path

import cv2
import numpy as np

from sensei import config
from sensei.geometry import rectify
from sensei.planogram import load_planogram

ROOT = config.ROOT
pg = load_planogram()
team = json.loads((ROOT / "eval" / "labels.json").read_text(encoding="utf-8"))
andre = json.loads(subprocess.check_output(["git", "show", "origin/main:annotations/andre/labels_andre.json"], cwd=ROOT).decode("utf-8"))


def pick(a_level, t_level, n):
    out = []
    for cam, imgs in andre.items():
        for img, areas in imgs.items():
            for aid, v in areas.items():
                if v["stock_level"] == a_level and team[cam][img][aid]["stock_level"] == t_level:
                    out.append((cam, img, aid))
    return out[:: max(1, len(out) // n)][:n]


cases = []
for c in pick("full", "half", 2):
    cases.append((*c, "A or B?  A: FULL (looks full, a few units missing)   B: HALF (not completely full)"))
for c in pick("empty", "half", 2):
    cases.append((*c, "A or B?  A: EMPTY (time to restock)   B: HALF (more than 1-2 units left)"))
cases.append(("6443", sorted(team["6443"])[6], "6443_11", "Do you judge the whole crate, or only the outlined area?"))
cases.append(("6383", sorted(team["6383"])[0], "6383_5", "Shutter down (store closed): empty? or not in the validation set?"))


def tile(cam, img, aid, question):
    im = cv2.imread(str(config.IMAGES_DIR / cam / img))
    a = pg.area(aid)
    crop, _ = rectify(im, a.quad, (400, 300))
    full = im.copy()
    cv2.polylines(full, [a.quad.astype(np.int32)], True, (0, 255, 255), 4)
    full = cv2.resize(full, (533, 300))
    t = np.full((380, 940, 3), 255, np.uint8)
    t[40:340, 0:533] = full
    t[40:340, 540:940] = crop
    cv2.putText(t, f"{cam} {img} area {a.index}: {a.info.short_name}", (6, 28), cv2.FONT_HERSHEY_SIMPLEX, 0.65, (0, 0, 0), 2)
    cv2.putText(t, question, (6, 368), cv2.FONT_HERSHEY_SIMPLEX, 0.55, (20, 20, 160), 2)
    return t


tiles = [tile(*c) for c in cases]
sheet = np.vstack([np.hstack(tiles[i:i + 2]) if i + 1 < len(tiles) else np.hstack([tiles[i], np.full_like(tiles[i], 255)])
                   for i in range(0, len(tiles), 2)])
out = ROOT / "docs" / "sensei_questions.jpg"
cv2.imwrite(str(out), sheet, [cv2.IMWRITE_JPEG_QUALITY, 85])
print(out)
