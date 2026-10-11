"""r3cost: can R3 (agents/predict.py, one DINOv2-S pass per photo) spend less CPU with byte-identical answers?

Hypothesis: the DINOv2 forward is GEMM-bound and near the single-core AVX2 peak, so pure fp32 rewrites gain little;
the free gains are around the forward (start-up, the log-only curtain look-up, repeated image copies/conversions,
md5 hashing) and in small op fusions (one QKV GEMM, one-pass SDPA). Expected: -5..-15% CPU per photo, 0 changes.

    python -I exp_r3cost.py VARIANT --images DIR --out OUT.json [--raw RAW.npz] [--agents AGENTS_DIR]

agents/predict.py runs unchanged in this process (runpy); VARIANT is a '+'-joined list of monkeypatches:
  base    as shipped (transformers Dinov2Model, no patch)
  lite    lab/r3fast/dinov2_lite.py backbone (no transformers; only hidden state 8 kept)
  qkv     lite + one fused 384->1152 QKV Linear instead of three Linears
  arr     rectify gets the photo as an RGB array once per photo (not img.convert("RGB") per area)
  nolog   the log-only night-curtain look-up is skipped (start-up refs and per-photo thumb)
  jit     lite + torch.jit.trace + freeze of the backbone (oneDNN fusions; may change numerics)
  i1      torch.set_num_interop_threads(1)
Prints per-photo CPU (process_time between photos), start-up CPU and total CPU; --raw saves the unrounded
probabilities for parity checks.
"""
import argparse
import os
import pathlib
import resource
import runpy
import sys
import time

HERE = pathlib.Path(__file__).resolve().parent
ap = argparse.ArgumentParser()
ap.add_argument("variant")
ap.add_argument("--images", required=True)
ap.add_argument("--out", required=True)
ap.add_argument("--raw")
ap.add_argument("--agents", default=str(HERE.parents[1] / "agents"))
args = ap.parse_args()
V = set(args.variant.split("+"))
AG = pathlib.Path(args.agents).resolve()
T0 = time.process_time()

import numpy as np  # noqa: E402
import torch  # noqa: E402

if "i1" in V:
    torch.set_num_interop_threads(1)
sys.path.insert(0, str(AG))
sys.path.insert(0, str(AG / "models" / "stock_4e"))
sys.path.insert(1, str(HERE))
import onepass_infer  # noqa: E402

RAW = {"ps": [], "q": []}
STAMPS = []   # process_time at the start of each photo


class Fused(torch.nn.Module):
    """q, k, v from one Linear(384, 1152); weights are the three original matrices stacked (exact copies)."""

    def __init__(self, sa):
        super().__init__()
        d = sa.query.weight.shape[0]
        self.heads, self.hd, self.scaling = sa.heads, sa.hd, sa.scaling
        self.qkv = torch.nn.Linear(d, 3 * d)
        with torch.no_grad():
            self.qkv.weight.copy_(torch.cat([sa.query.weight, sa.key.weight, sa.value.weight], 0))
            self.qkv.bias.copy_(torch.cat([sa.query.bias, sa.key.bias, sa.value.bias], 0))

    def forward(self, x):
        b, n, _ = x.shape
        qkv = self.qkv(x).view(b, n, 3, self.heads, self.hd).permute(2, 0, 3, 1, 4)
        o = torch.nn.functional.scaled_dot_product_attention(qkv[0], qkv[1], qkv[2], scale=self.scaling)
        return o.transpose(1, 2).reshape(b, n, self.heads * self.hd)


class Patched(onepass_infer.OnePass):
    def __init__(self, size=224, device="cpu", threads=None, tag="", b8_stock=None):
        if not (V & {"lite", "qkv", "jit"}):
            super().__init__(size, device, threads, tag, b8_stock)
            self.kind = "hf"
            return
        from dinov2_lite import Dinov2Lite
        import json
        if threads:
            torch.set_num_threads(threads)
        H = pathlib.Path(onepass_infer.__file__).resolve().parent
        stem = H / "deploy" / (f"onepass_s{size}" + (f"_{tag}" if tag else ""))
        self.meta = json.loads(pathlib.Path(str(stem) + ".json").read_text(encoding="utf-8"))
        sd = torch.load(str(stem) + ".pt", map_location="cpu")
        self.bb = Dinov2Lite.from_state_dict(str(H / "deploy" / "dinov2_small_config.json"),
                                             {k[3:]: v for k, v in sd.items() if k.startswith("bb.")})
        if "qkv" in V:
            for layer in self.bb.encoder.layer:
                layer.attention.attention = Fused(layer.attention.attention)
        self.head = torch.nn.Linear(sd["head.weight"].shape[1], sd["head.weight"].shape[0])
        self.head.load_state_dict({"weight": sd["head.weight"], "bias": sd["head.bias"]})
        self.dev = device
        self.bb.eval()
        self.head.eval()
        p = np.load(str(stem) + "_product.npz")
        self.mu, self.sd, self.coef, self.b = p["mu"], p["sd"], p["coef"], p["intercept"]
        self.cls = {c: j for j, c in enumerate(p["classes"].tolist())}
        self.size = size
        self.b8 = None
        if b8_stock:
            q = np.load(b8_stock)
            self.b8 = (q["mu"], q["sd"], q["coef"], q["intercept"])
        self.mean = torch.tensor(self.meta["normalise"]["mean"]).view(1, 3, 1, 1)
        self.std = torch.tensor(self.meta["normalise"]["std"]).view(1, 3, 1, 1)
        self.kind = "lite"
        self._jit = {}

    def crops(self, img, areas):
        if "arr" in V and not isinstance(img, np.ndarray):
            img = np.asarray(img.convert("RGB")) if img.mode != "RGB" else np.asarray(img)
        return super().crops(img, areas)

    def _bb(self, x):
        if self.kind == "hf":
            out = self.bb(pixel_values=x, output_hidden_states=True)
            return out.last_hidden_state, out.hidden_states[8]
        if "jit" in V:
            n = x.shape[0]
            if n not in self._jit:
                class W(torch.nn.Module):
                    def __init__(s, bb):
                        super().__init__()
                        s.bb = bb

                    def forward(s, x):
                        h, k = s.bb(x, keep=(8,))
                        return h, k[8]
                self._jit[n] = torch.jit.freeze(torch.jit.trace(W(self.bb).eval(), x))
            return self._jit[n](x)
        h, kept = self.bb(x, keep=(8,))
        return h, kept[8]

    @torch.no_grad()
    def predict(self, img, areas):   # = OnePass.predict, backbone call through _bb, raw probabilities recorded
        x = torch.from_numpy(self.crops(img, areas)).permute(0, 3, 1, 2).float() / 255.0
        x = ((x - self.mean) / self.std).to(self.dev)
        h, h8 = self._bb(x)
        ps = torch.softmax(self.head(torch.cat([h[:, 0], h[:, 1:].mean(1)], 1)), 1).cpu().numpy()
        f8 = torch.cat([h8[:, 0], h8[:, 1:].mean(1)], 1).cpu().numpy()
        if self.b8 is not None:
            mu8, sd8, c8, b8 = self.b8
            z8 = ((f8 - mu8) / sd8) @ c8.T + b8
            p8 = np.exp(z8 - z8.max(1, keepdims=True))
            ps = (ps + p8 / p8.sum(1, keepdims=True)) / 2
        z = ((f8 - self.mu) / self.sd) @ self.coef.T + self.b
        q = np.exp(z - z.max(1, keepdims=True))
        q /= q.sum(1, keepdims=True)
        RAW["ps"].append(ps)
        RAW["q"].append(q)
        res = {}
        for a, p, qq in zip(areas, ps, q):
            fam = self.meta["planned_family"].get(a["area_id"], "")
            p_ok = float((qq[self.cls[fam]] if fam in self.cls else 0.0) + (qq[self.cls["EMPTY"]] if "EMPTY" in self.cls else 0.0))
            res[a["area_id"]] = dict(compliant=p_ok >= 0.5, p_ok=round(p_ok, 4), p_stock=[round(float(v), 4) for v in p],
                                     stock_value=onepass_infer.LEVELS[int(np.argmax(onepass_infer.PAY @ p))])
        return res


onepass_infer.OnePass = Patched
os.environ.setdefault("ONEPASS_THREADS", "1")

# predict.py imports these names from common; patch the module objects it will bind to
import common  # noqa: E402
import common.data as cdata  # noqa: E402

_orig_load = cdata.load_image


def load_image(path):
    STAMPS.append(time.process_time())
    return _orig_load(path)


common.load_image = load_image
if "nolog" in V:
    common.curtain_down = lambda img, cam: (False, 0.0)
    cdata._curtain_refs = lambda: {"off": None}   # non-empty: no WARN line, nothing decoded

sys.argv = ["predict.py", "--images", args.images, "--planogram", str(AG.parent / "data" / "planogram.json")
            if not os.environ.get("SENSEI_DATASET") else os.path.join(os.environ["SENSEI_DATASET"], "planogram.json"),
            "--out", args.out]
code = 0
try:
    runpy.run_path(str(AG / "predict.py"), run_name="__main__")
except SystemExit as e:
    code = e.code
T_END = time.process_time()
ru = resource.getrusage(resource.RUSAGE_SELF)
per = np.diff(STAMPS + [T_END])   # last photo includes writing the JSON (a few ms)
startup = STAMPS[0] if STAMPS else float("nan")
print(f"R3COST {args.variant} exit={code} photos={len(STAMPS)} startup_cpu={startup:.2f}s "
      f"per_photo_cpu median={np.median(per):.3f} max={per.max():.3f} mean={per.mean():.3f} "
      f"total_cpu={T_END:.2f}s ({T_END / len(STAMPS):.3f}/photo incl start-up) maxrss={ru.ru_maxrss / 1024:.0f}MB")
if args.raw:
    np.savez(args.raw, ps=np.concatenate(RAW["ps"]), q=np.concatenate(RAW["q"]), per=per, startup=startup)
