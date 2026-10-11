"""Label-free model (line B, candidate U2): zero labels, image only at prediction (+ a per-area baseline built once from
UNLABELLED photos of the store). Lite SigLIP2-base vision tower only; the prompt embeddings ship as numbers.

    m = LabelFree()                     # loads models/compliance/deploy/labelfree_*  (offline: no hub download)
    m.predict(img, areas) -> {area_id: {"compliant": bool, "p_ok": float, "p_stock": [pE, pH, pF], "stock_value": v,
                                        "floor_share": s, "floor_share_rel": s'}}

Product: polygon crop -> 224 (bilinear) -> SigLIP2-base -> zero-shot over the camera's product families (catalog
  descriptions x 3 templates; a family scores as its best member) + EMPTY; native logit scale; prior planned 0.5, the
  rest share 0.5; compliant iff P(planned) + P(EMPTY) >= 0.5.
Stock: whole-crate crop at 448 -> central 80% -> GRID x GRID tiles -> 224 -> SigLIP2-base; a tile is floor iff the mean
  logit of 3 "empty crate floor" prompts beats the max logit of 2 prompts of the planned product; s = floor share;
  s' = max(0, s - baseline[area]) with baseline = the area's minimum s over the store's unlabelled photos;
  empty if s' >= 0.85, half if s' >= 0.30, else full.
Build the deploy files with models/compliance/labelfree_deploy.py.

usage (check): py -I models/compliance/labelfree_infer.py   -> parity with preds/4e_unsup_U2_all.json on 14 photos
"""
import json
import pathlib
import sys

import cv2
import numpy as np
import torch
from PIL import Image

HERE = pathlib.Path(__file__).resolve().parent
ROOT = HERE.parents[1]
sys.path.insert(0, str(ROOT))
from common import rectify  # noqa: E402

DEPLOY = HERE / "deploy"


class LabelFree:
    def __init__(self, device="cpu", threads=None, deploy=DEPLOY):
        from transformers import SiglipVisionConfig, SiglipVisionModel
        if threads:
            torch.set_num_threads(threads)
        self.meta = json.loads((deploy / "labelfree_meta.json").read_text(encoding="utf-8"))
        self.vm = SiglipVisionModel(SiglipVisionConfig.from_json_file(str(deploy / "siglip2b_vision_config.json")))
        sd = torch.load(str(deploy / "siglip2b_vision_fp16.pt"), map_location="cpu")
        self.vm.load_state_dict(sd, strict=True)
        self.dev = device
        self.vm.to(device).eval()
        t = np.load(deploy / "labelfree_text.npz")
        self.scale, self.bank, self.floor = float(t["scale"]), t["bank"], t["floor"]
        self.pids = t["pids"].tolist()
        self.prod = {p: e for p, e in zip(t["prod_pids"].tolist(), t["prod"])}
        self.base = json.loads((deploy / "labelfree_baselines.json").read_text(encoding="utf-8"))
        self.grid = int(self.meta["grid"])

    @torch.no_grad()
    def embed(self, crops):
        x = (torch.from_numpy(np.stack(crops)).permute(0, 3, 1, 2).float() / 255.0 - 0.5) / 0.5
        out = [self.vm(pixel_values=x[s:s + 128].to(self.dev)).pooler_output.float() for s in range(0, len(x), 128)]
        return torch.nn.functional.normalize(torch.cat(out), dim=-1).cpu().numpy()

    def tiles(self, c448):
        lo, hi = int(round(448 * 0.1)), int(round(448 * 0.9))
        c = c448[lo:hi, lo:hi]
        st = (hi - lo) / self.grid
        return [cv2.resize(c[int(r * st):int((r + 1) * st), int(q * st):int((q + 1) * st)], (224, 224),
                           interpolation=cv2.INTER_LINEAR) for r in range(self.grid) for q in range(self.grid)]

    def predict(self, img, areas):
        poly = [np.asarray(Image.fromarray(np.asarray(rectify(img, a, size=None))).resize((224, 224), Image.BILINEAR))
                for a in areas]
        tl = []
        for a in areas:
            tl += self.tiles(np.asarray(rectify(img, a, size=(448, 448), expand_depth="auto", expand_front="auto")))
        ep, et = self.embed(poly), self.embed(tl).reshape(len(areas), self.grid * self.grid, -1)
        out = {}
        cams = self.meta["camera_products"]
        for a, e, t in zip(areas, ep, et):
            aid, cam = a["area_id"], a["area_id"].split("_")[0]
            planned = self.meta["family"][a["product_id"]]
            lg = {}
            for pid in cams[cam]:
                f = self.meta["family"][pid]
                lg[f] = max(lg.get(f, -1e9), self.scale * float(self.bank[self.pids.index(pid)] @ e))
            lg["EMPTY"] = self.scale * float(self.bank[-1] @ e)
            states = list(lg)
            prior = np.array([0.5 if s == planned else 0.5 / (len(states) - 1) for s in states])
            z = np.array([lg[s] for s in states]) + np.log(prior)
            post = np.exp(z - z.max())
            post /= post.sum()
            p_ok = float(sum(p for s, p in zip(states, post) if s in (planned, "EMPTY")))
            lf = (self.scale * (t @ self.floor.T)).mean(1)
            lp = (self.scale * (t @ self.prod[a["product_id"]].T)).max(1)
            s = float((lf > lp).mean())
            sr = max(0.0, s - float(self.base.get(aid, 0.0)))
            lv = 0.0 if sr >= self.meta["t_empty"] else 0.5 if sr >= self.meta["t_half"] else 1.0
            out[aid] = dict(compliant=p_ok >= 0.5, p_ok=round(p_ok, 4), stock_value=lv,
                            p_stock=[float(lv == 0.0), float(lv == 0.5), float(lv == 1.0)],
                            floor_share=round(s, 4), floor_share_rel=round(sr, 4))
        return out


if __name__ == "__main__":
    import time
    from common import list_images, load_image, load_planogram
    m = LabelFree(threads=4)
    pg = load_planogram()
    ref = json.loads((ROOT / "preds" / f"4e_unsup_{m.meta['candidate']}_all.json").read_text(encoding="utf-8"))
    newest = {}
    for r in list_images():
        if r.cam not in newest or r.ts > newest[r.cam].ts:
            newest[r.cam] = r
    n = same_c = same_s = 0
    t0 = time.perf_counter()
    for cam, r in sorted(newest.items()):
        out = m.predict(load_image(r.path), pg[cam])
        for k, v in out.items():
            e = ref[cam][r.fname][k]
            n += 1
            same_c += v["compliant"] == e["planogram_compliant"]
            same_s += v["stock_value"] == float(e["stock_value"])
    print(f"parity with preds/4e_unsup_{m.meta['candidate']}_all.json on {n} areas of 14 photos: product {same_c}/{n}, "
          f"stock {same_s}/{n}; {(time.perf_counter() - t0) / 14:.1f} s/photo")
