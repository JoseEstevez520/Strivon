"""Sensei's hint as a predictor: the camera estimates a continuous fill, a per-product rule turns it into a level.
Runs only the 8 frozen DINOv2-small blocks (the deployed model runs 12), so it is cheaper per photo.
  python -I lab/hint_fill/predict_fill.py --images DIR --planogram data/planogram.json --out FILE [--calibration rules.json]
Output: the challenge format (planogram_compliant, stock_level, stock_value) plus fill_raw (0..1), which the app's
Calibration page reads. Product check: the deployed one-pass product head on the same block-8 features.
--calibration: {"family": [t1, t2]} -> empty if fill < t1, half if fill < t2, else full. Without it the level is the
best expected challenge points from the ordinal probabilities (+1 / -2 below / -3 above)."""
import argparse, glob, json, os, pathlib, sys, time
import numpy as np, torch
HERE = pathlib.Path(__file__).resolve().parent; REPO = HERE.parents[1]
sys.path.insert(0, str(REPO / "agents")); sys.path.insert(0, str(REPO / "agents" / "models" / "stock_4e"))
from onepass_infer import OnePass  # noqa: E402
PAY = np.array([[1, -2, -2], [-3, 1, -2], [-3, -3, 1]], float); NAME = ["empty", "half", "full"]

@torch.inference_mode()
def features(m, img, areas):
    x = torch.from_numpy(m.crops(img, areas)).permute(0, 3, 1, 2).float() / 255.0
    h = m.bb.embeddings((x - m.mean) / m.std)
    for i, layer in enumerate(m.bb.encoder.layer[:8], 1):   # stop after block 8: blocks 9-12 are never run
        h = layer(h)
        if i == 4:
            h4 = h[:, 1:].mean(1)
    f8 = torch.cat([h[:, 0], h[:, 1:].mean(1)], 1)
    return torch.cat([f8, h4], 1).numpy(), f8.numpy()

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--images", required=True); ap.add_argument("--planogram", required=True); ap.add_argument("--out", required=True)
    ap.add_argument("--calibration"); ap.add_argument("--threads", type=int, default=1)
    a = ap.parse_args()
    from common import load_image, load_planogram
    torch.set_num_threads(a.threads); t0 = time.time()
    m = OnePass(224, threads=a.threads, tag="ld6ee_mix"); pg = load_planogram(a.planogram)
    H = np.load(HERE / "hint_heads.npz"); cal = json.load(open(a.calibration)) if a.calibration else {}
    out, n = {}, 0
    for p in sorted(glob.glob(os.path.join(a.images, "*", "*.jpg"))):
        cam, f = pathlib.Path(p).parent.name, pathlib.Path(p).name
        if cam not in pg: continue
        areas = pg[cam]; X, f8 = features(m, load_image(p), areas); Z = (X - H["mu"]) / H["sd"]
        pa = 1 / (1 + np.exp(-(Z @ H["wa"] + H["ba"]))); pb = np.minimum(pa, 1 / (1 + np.exp(-(Z @ H["wb"] + H["bb"]))))
        fill = 0.5 * pa + 0.5 * pb; probs = np.stack([1 - pa, pa - pb, pb], 1)
        z = ((f8 - m.mu) / m.sd) @ m.coef.T + m.b; q = np.exp(z - z.max(1, keepdims=True)); q /= q.sum(1, keepdims=True)
        for j, ar in enumerate(areas):
            aid = ar["area_id"]; fam = m.meta["planned_family"].get(aid, "")
            p_ok = (q[j][m.cls[fam]] if fam in m.cls else 0.0) + (q[j][m.cls["EMPTY"]] if "EMPTY" in m.cls else 0.0)
            if fam in cal: t1, t2 = cal[fam]; lv = 0 if fill[j] < t1 else 1 if fill[j] < t2 else 2
            else: lv = int(np.argmax(PAY @ probs[j]))
            out.setdefault(cam, {}).setdefault(f, {})[aid] = {"planogram_compliant": bool(p_ok >= 0.5), "stock_level": NAME[lv],
                                                              "stock_value": [0, 0.5, 1][lv], "fill_raw": round(float(fill[j]), 4)}
            n += 1
    pathlib.Path(a.out).parent.mkdir(parents=True, exist_ok=True); json.dump(out, open(a.out, "w"), indent=1)
    print(f"OK (hint fill model): {n} areas in {sum(len(v) for v in out.values())} photos -> {a.out} [{time.time() - t0:.0f}s]")

if __name__ == "__main__":
    main()
