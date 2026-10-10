"""Draw predicted stock per area on an image: python backend/debug_view.py <cam> <image.jpg>"""
import json
import sys

import cv2

from crops import IMAGES, ROOT, corners, load_planogram

COL = {"empty": (0, 0, 255), "half": (0, 200, 255), "full": (0, 200, 0)}

cam, name = sys.argv[1], sys.argv[2]
preds = json.load(open(ROOT / "outputs" / "predictions.json"))[cam][name]
img = cv2.imread(str(IMAGES / cam / name))
for a in load_planogram()[cam]["products"]:
    p = preds[a["area_id"]]
    pts = corners(a).astype(int)
    cv2.polylines(img, [pts], True, COL[p["stock_level"]], 3)
    cv2.putText(img, f'{a["area_id"].split("_")[1]}:{p["stock_level"][0]}', tuple(pts[0] + [4, 20]),
                cv2.FONT_HERSHEY_SIMPLEX, 0.6, (255, 255, 255), 2)
out = ROOT / "outputs" / f"debug_{cam}.jpg"
cv2.imwrite(str(out), img)
print(out)
