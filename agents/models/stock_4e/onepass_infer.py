"""Inference of the deployed one-pass image-only model (fx_deploy.py): both answers from ONE DINOv2-S pass per photo,
looking only at the image under analysis. Needs torch + transformers, no sklearn and no Hugging Face download: the
backbone is built from deploy/dinov2_small_config.json and every weight comes from the .pt file (works offline).

    m = OnePass(size=224)                      # loads models/stock_4e/deploy/onepass_s224.* (s168 also exists)
    m.predict(img, areas)  -> {area_id: {"compliant": bool, "p_ok": float, "p_stock": [pE, pH, pF], "stock_value": v}}

usage (check): py -I models/stock_4e/onepass_infer.py [SIZE]   -> answers for the newest photo of two cameras + timing
"""
import json
import pathlib
import sys

import cv2
import numpy as np
import torch

HERE = pathlib.Path(__file__).resolve().parent
ROOT = HERE.parents[1]
sys.path.insert(0, str(ROOT))
from common import rectify  # noqa: E402

PAY = np.array([[1, -2, -2], [-3, 1, -2], [-3, -3, 1]], float)
LEVELS = (0.0, 0.5, 1.0)


class OnePass:
    def __init__(self, size=224, device="cpu", threads=None):
        from transformers import Dinov2Config, Dinov2Model
        if threads:
            torch.set_num_threads(threads)
        stem = HERE / "deploy" / f"onepass_s{size}"
        self.meta = json.loads(pathlib.Path(str(stem) + ".json").read_text(encoding="utf-8"))
        sd = torch.load(str(stem) + ".pt", map_location="cpu")
        self.bb = Dinov2Model(Dinov2Config.from_json_file(str(HERE / "deploy" / "dinov2_small_config.json")))
        self.bb.load_state_dict({k[3:]: v for k, v in sd.items() if k.startswith("bb.")}, strict=True)
        self.head = torch.nn.Linear(sd["head.weight"].shape[1], sd["head.weight"].shape[0])
        self.head.load_state_dict({"weight": sd["head.weight"], "bias": sd["head.bias"]})
        self.dev = device
        self.bb.to(device).eval()
        self.head.to(device).eval()
        p = np.load(str(stem) + "_product.npz")
        self.mu, self.sd, self.coef, self.b = p["mu"], p["sd"], p["coef"], p["intercept"]
        self.cls = {c: j for j, c in enumerate(p["classes"].tolist())}
        self.size = size
        self.mean = torch.tensor(self.meta["normalise"]["mean"]).view(1, 3, 1, 1)
        self.std = torch.tensor(self.meta["normalise"]["std"]).view(1, 3, 1, 1)

    def crops(self, img, areas):
        out = []
        for a in areas:   # as in training: the whole-crate crop at 224, then INTER_AREA to SIZE
            c = np.asarray(rectify(img, a, size=(224, 224), expand_depth="auto", expand_front="auto"))
            out.append(c if self.size == 224 else cv2.resize(c, (self.size, self.size), interpolation=cv2.INTER_AREA))
        return np.stack(out)

    @torch.no_grad()
    def predict(self, img, areas):
        x = torch.from_numpy(self.crops(img, areas)).permute(0, 3, 1, 2).float() / 255.0
        x = ((x - self.mean) / self.std).to(self.dev)
        out = self.bb(pixel_values=x, output_hidden_states=True)
        h, h8 = out.last_hidden_state, out.hidden_states[8]
        ps = torch.softmax(self.head(torch.cat([h[:, 0], h[:, 1:].mean(1)], 1)), 1).cpu().numpy()
        f8 = torch.cat([h8[:, 0], h8[:, 1:].mean(1)], 1).cpu().numpy()
        z = ((f8 - self.mu) / self.sd) @ self.coef.T + self.b
        q = np.exp(z - z.max(1, keepdims=True))
        q /= q.sum(1, keepdims=True)
        res = {}
        for a, p, qq in zip(areas, ps, q):
            fam = self.meta["planned_family"].get(a["area_id"], "")
            p_ok = float((qq[self.cls[fam]] if fam in self.cls else 0.0) + (qq[self.cls["EMPTY"]] if "EMPTY" in self.cls else 0.0))
            res[a["area_id"]] = dict(compliant=p_ok >= 0.5, p_ok=round(p_ok, 4), p_stock=[round(float(v), 4) for v in p],
                                     stock_value=LEVELS[int(np.argmax(PAY @ p))])
        return res


if __name__ == "__main__":
    import time
    from common import list_images, load_image, load_planogram
    size = int(sys.argv[1]) if len(sys.argv) > 1 else 224
    m = OnePass(size, threads=4)
    pg = load_planogram()
    newest = {}
    for r in list_images():
        if r.cam not in newest or r.ts > newest[r.cam].ts:
            newest[r.cam] = r
    for cam in ("6215", "6376"):
        r = newest[cam]
        t = time.perf_counter()
        out = m.predict(load_image(r.path), pg[cam])
        print(f"{cam}/{r.fname} ({time.perf_counter() - t:.2f} s):",
              {k: (v["compliant"], v["stock_value"]) for k, v in out.items()})
