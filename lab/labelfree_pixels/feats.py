import sys, json, os, glob
import numpy as np, cv2
import pathlib
HERE = pathlib.Path(__file__).resolve().parent
REPO = HERE.parents[1]
sys.path.insert(0, str(REPO / "agents"))
from common.crops import rectify, rectify_mask
R = str(REPO / "data")
plan = json.load(open(R + r"\planogram.json", encoding="utf-8"))["Frutas e Legumes"]["cameras"]
out = {}  # area -> {img: feats}
crops = {}
for cam, d in plan.items():
    imgs = sorted(glob.glob(os.path.join(R, "images", cam, "*.jpg")))
    for p in imgs:
        im = cv2.imread(p)[:, :, ::-1].copy()
        name = os.path.basename(p)
        for a in d["products"]:
            aid = a["area_id"]
            c = rectify(im, a, size=(128, 128))
            m = rectify_mask(a, size=(128, 128))
            if m.sum() < 100: continue
            g = cv2.cvtColor(c, cv2.COLOR_RGB2GRAY)
            hsv = cv2.cvtColor(c, cv2.COLOR_RGB2HSV)
            e = cv2.Canny(g, 50, 150) > 0
            lap = cv2.Laplacian(g.astype(np.float32), cv2.CV_32F)
            gf = g.astype(np.float32)
            mu = cv2.blur(gf, (7, 7)); sd = np.sqrt(np.maximum(cv2.blur(gf * gf, (7, 7)) - mu * mu, 0))
            f = dict(edge=float(e[m].mean()), lapvar=float(lap[m].var()), sat=float(hsv[..., 1][m].mean()),
                     flat=float((sd[m] < 6).mean()), dark=float((hsv[..., 2][m] < 60).mean()),
                     val=float(hsv[..., 2][m].mean()))
            out.setdefault(aid, {})[name] = f
            crops.setdefault(aid, {})[name] = c
# deviation from per-area median crop (pixel-level)
for aid, dd in crops.items():
    names = list(dd); stack = np.stack([dd[n].astype(np.float32) for n in names])
    med = np.median(stack, 0)
    hs = [cv2.calcHist([cv2.cvtColor(dd[n], cv2.COLOR_RGB2HSV)], [0, 1], None, [18, 8], [0, 180, 0, 256]).ravel() for n in names]
    hs = [h / h.sum() for h in hs]; hmed = np.median(np.stack(hs), 0)
    for n, s, h in zip(names, stack, hs):
        out[aid][n]["pixdev"] = float(np.abs(s - med).mean())
        out[aid][n]["histdev"] = float(np.abs(h - hmed).sum())
json.dump(out, open(HERE / "feats.json", "w"))
print(len(out), sum(len(v) for v in out.values()))
