"""r3cost (forward bench): time R3's per-photo stages and backbone variants in ONE process, interleaved, single thread,
and check that each variant gives exactly the same tensors as the shipped transformers backbone.

Hypothesis: same as exp_r3cost.py; this file isolates the forward (less noise than end-to-end runs) and prices the
small per-photo overheads of predict.py / onepass.py (img.copy x2, md5 x2, curtain thumb, convert per area).

    python -I exp_r3cost_fwd.py IMAGES_DIR [N_PHOTOS] [REPS]
"""
import hashlib
import pathlib
import sys
import time

import numpy as np
import torch

HERE = pathlib.Path(__file__).resolve().parent
AG = HERE.parents[1] / "agents"
sys.path.insert(0, str(AG))
sys.path.insert(0, str(AG / "models" / "stock_4e"))
sys.path.insert(1, str(HERE))
torch.set_num_threads(1)
from common import curtain_down, list_images, load_image, load_planogram  # noqa: E402
from onepass_infer import OnePass  # noqa: E402
from dinov2_lite import Dinov2Lite  # noqa: E402

N = int(sys.argv[2]) if len(sys.argv) > 2 else 8
REPS = int(sys.argv[3]) if len(sys.argv) > 3 else 3
DEP = AG / "models" / "stock_4e" / "deploy"
m = OnePass(224, threads=1, tag="ld6ee", b8_stock=str(AG / "models" / "onepass" / "deploy" / "stockb8.npz"))
sd = torch.load(str(DEP / "onepass_s224_ld6ee.pt"), map_location="cpu")
lite = Dinov2Lite.from_state_dict(str(DEP / "dinov2_small_config.json"), {k[3:]: v for k, v in sd.items() if k.startswith("bb.")})
pg = load_planogram(str(AG.parent / "data" / "planogram.json"))
recs = list_images(sys.argv[1], str(AG.parent / "data" / "planogram.json"))
step = max(1, len(recs) // N)
recs = recs[::step][:N]


def cpu(fn, *a):
    t = time.process_time()
    r = fn(*a)
    return time.process_time() - t, r


# ---- per-photo overheads around the forward ----
over = {k: [] for k in ("decode", "img.copy x2", "md5 x2", "curtain_down", "crops (convert per area)",
                        "crops (array once)", "normalise")}
xs = []
for r in recs:
    dt, img = cpu(load_image, r.path)
    over["decode"].append(dt)
    over["img.copy x2"].append(cpu(lambda: (img.copy(), img.copy()))[0])
    over["md5 x2"].append(cpu(lambda: [hashlib.md5(img.tobytes()).hexdigest() for _ in range(2)])[0])
    over["curtain_down"].append(cpu(curtain_down, img, r.cam)[0])
    areas = pg[r.cam]
    dt, c1 = cpu(m.crops, img, areas)
    over["crops (convert per area)"].append(dt)
    dt, c2 = cpu(m.crops, np.asarray(img), areas)
    over["crops (array once)"].append(dt)
    assert np.array_equal(c1, c2)
    dt, x = cpu(lambda: (torch.from_numpy(c1).permute(0, 3, 1, 2).float() / 255.0 - m.mean) / m.std)
    over["normalise"].append(dt)
    xs.append(x)
print(f"photos {len(recs)}, areas {[x.shape[0] for x in xs]}")
for k, v in over.items():
    print(f"  {k:26s} median {np.median(v) * 1000:7.1f} ms  max {np.max(v) * 1000:7.1f} ms")


# ---- backbone variants ----
def f_hf(x):
    o = m.bb(pixel_values=x, output_hidden_states=True)
    return o.last_hidden_state, o.hidden_states[8]


def f_lite(x):
    h, k = lite(x, keep=(8,))
    return h, k[8]


class W(torch.nn.Module):
    def __init__(self, bb):
        super().__init__()
        self.bb = bb

    def forward(self, x):
        h, k = self.bb(x, keep=(8,))
        return h, k[8]


_jit = {}


def f_jit(x):
    n = x.shape[0]
    if n not in _jit:
        _jit[n] = torch.jit.freeze(torch.jit.trace(W(lite).eval(), x))
        _jit[n](x)
        _jit[n](x)
    return _jit[n](x)


lite_q = Dinov2Lite.from_state_dict(str(DEP / "dinov2_small_config.json"), {k[3:]: v for k, v in sd.items() if k.startswith("bb.")})
sys.argv = sys.argv[:1] + ["--images", ".", "--out", "x"]   # exp_r3cost parses argv at import; only its Fused is used
import importlib.util  # noqa: E402
spec = importlib.util.spec_from_file_location("r3c", HERE / "exp_r3cost.py")
_src = (HERE / "exp_r3cost.py").read_text()
_ns = {}
exec(_src[_src.index("class Fused"):_src.index("class Patched")], {"torch": torch}, _ns)
for layer in lite_q.encoder.layer:
    layer.attention.attention = _ns["Fused"](layer.attention.attention)


def f_qkv(x):
    h, k = lite_q(x, keep=(8,))
    return h, k[8]


VARS = {"hf (shipped)": f_hf, "lite": f_lite, "lite+qkv": f_qkv, "lite+jit.freeze": f_jit}
ref = []
with torch.no_grad():
    for x in xs:
        ref.append(f_hf(x))
    for name, f in VARS.items():   # warm-up + exactness
        d = 0.0
        same = True
        for x, (h0, k0) in zip(xs, ref):
            h, k = f(x)
            same &= torch.equal(h, h0) and torch.equal(k, k0)
            d = max(d, (h - h0).abs().max().item(), (k - k0).abs().max().item())
        print(f"  {name:18s} bit-identical={same} max|diff|={d:.2e}")
    t = {k: [] for k in VARS}
    for rep in range(REPS):
        for name, f in VARS.items():
            for x in xs:
                t[name].append(cpu(f, x)[0] / x.shape[0])
with torch.inference_mode():
    t["lite inference_mode"] = [cpu(f_lite, x)[0] / x.shape[0] for _ in range(REPS) for x in xs]
for name, v in t.items():
    print(f"  {name:22s} ms per crop: median {np.median(v) * 1000:6.1f}  max {np.max(v) * 1000:6.1f}")
