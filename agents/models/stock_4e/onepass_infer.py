"""Inference of the deployed one-pass image-only model (fx_deploy.py): both answers from ONE DINOv2-S pass per photo,
looking only at the image under analysis. Needs torch, no transformers, no sklearn and no Hugging Face download: the
backbone is dinov2_lite.py (Jose's lab: the same modules and ops as transformers' Dinov2Model, without importing it),
built from deploy/dinov2_small_config.json, and every weight comes from the .pt file (works offline).

    m = OnePass(size=224, tag="l1221", b8_stock=PATH)  # loads models/stock_4e/deploy/onepass_s224_l1221.*;
                                               # b8_stock: optional block-8 stock head averaged 1:1 (round-2 R3)
    m.predict(img, areas)  -> {area_id: {"compliant": bool, "p_ok": float, "p_stock": [pE, pH, pF], "stock_value": v}}

usage (check): py -I models/stock_4e/onepass_infer.py [SIZE] [TAG] [B8_STOCK.npz] -> newest photo of two cameras + timing
"""
import json
import os
import pathlib
import sys

import cv2
import numpy as np
import torch

HERE = pathlib.Path(__file__).resolve().parent
ROOT = HERE.parents[1]
sys.path.insert(0, str(ROOT))
sys.path.insert(0, str(HERE))  # dinov2_lite.py, also when this file is run directly with -I
from common import rectify  # noqa: E402

PAY = np.array([[1, -2, -2], [-3, 1, -2], [-3, -3, 1]], float)
LEVELS = (0.0, 0.5, 1.0)


class OnePass:
    def __init__(self, size=224, device="cpu", threads=None, tag="", b8_stock=None):
        from dinov2_lite import Dinov2Lite   # same modules and ops as transformers' Dinov2Model, no transformers import
        if threads:
            torch.set_num_threads(threads)
        stem = HERE / "deploy" / (f"onepass_s{size}" + (f"_{tag}" if tag else ""))
        self.meta = json.loads(pathlib.Path(str(stem) + ".json").read_text(encoding="utf-8"))
        sd = torch.load(str(stem) + ".pt", map_location="cpu")
        self.bb = Dinov2Lite.from_state_dict(str(HERE / "deploy" / "dinov2_small_config.json"),
                                             {k[3:]: v for k, v in sd.items() if k.startswith("bb.")})
        self.head = torch.nn.Linear(sd["head.weight"].shape[1], sd["head.weight"].shape[0])
        self.head.load_state_dict({"weight": sd["head.weight"], "bias": sd["head.bias"]})
        self.dev = device
        self.bb.to(device).eval()
        q_from = os.environ.get("ONEPASS_INT8_FROM", "")
        if q_from and device == "cpu":   # int8 weights for blocks >= q_from (0-based): about 20% less CPU at 6,
            from torch.ao.quantization import default_dynamic_qconfig, quantize_dynamic   # 1 of 304 forward answers moved
            k = int(q_from)
            spec = {n: default_dynamic_qconfig for n, mod in self.bb.named_modules()
                    if isinstance(mod, torch.nn.Linear) and n.startswith("encoder.layer.") and int(n.split(".")[2]) >= k}
            self.bb = quantize_dynamic(self.bb, spec, dtype=torch.qint8)
        self.head.to(device).eval()
        p = np.load(str(stem) + "_product.npz")
        self.mu, self.sd, self.coef, self.b = p["mu"], p["sd"], p["coef"], p["intercept"]
        self.cls = {c: j for j, c in enumerate(p["classes"].tolist())}
        self.size = size
        self.b8 = None
        if b8_stock:   # -b7's stock head on the same block-8 features (mu, sd, coef, intercept; classes 0/1/2)
            q = np.load(b8_stock)
            self.b8 = (q["mu"], q["sd"], q["coef"], q["intercept"])
        self.mean = torch.tensor(self.meta["normalise"]["mean"]).view(1, 3, 1, 1)
        self.std = torch.tensor(self.meta["normalise"]["std"]).view(1, 3, 1, 1)

    def crops(self, img, areas):
        out = []
        for a in areas:   # as in training: the whole-crate crop at 224, then INTER_AREA to SIZE
            c = np.asarray(rectify(img, a, size=(224, 224), expand_depth="auto", expand_front="auto"))
            out.append(c if self.size == 224 else cv2.resize(c, (self.size, self.size), interpolation=cv2.INTER_AREA))
        return np.stack(out)

    @torch.inference_mode()
    def predict(self, img, areas):
        x = torch.from_numpy(self.crops(img, areas)).permute(0, 3, 1, 2).float() / 255.0
        x = ((x - self.mean) / self.std).to(self.dev)
        h, kept = self.bb(x, keep=(8,))
        h8 = kept[8]
        ps = torch.softmax(self.head(torch.cat([h[:, 0], h[:, 1:].mean(1)], 1)), 1).cpu().numpy()
        f8 = torch.cat([h8[:, 0], h8[:, 1:].mean(1)], 1).cpu().numpy()
        if self.b8 is not None:   # R3: average the fine-tuned stock head 1:1 with the block-8 stock head
            mu8, sd8, c8, b8 = self.b8
            z8 = ((f8 - mu8) / sd8) @ c8.T + b8
            p8 = np.exp(z8 - z8.max(1, keepdims=True))
            ps = (ps + p8 / p8.sum(1, keepdims=True)) / 2
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
    tag = sys.argv[2] if len(sys.argv) > 2 else ""
    b8 = sys.argv[3] if len(sys.argv) > 3 else None
    m = OnePass(size, threads=4, tag=tag, b8_stock=b8)
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
