"""Retrain R3, the supervised model that agents/predict.py ships (weights tag ld6ee). One DINOv2-S pass over each
planogram area of the photo under analysis gives both answers: the product check and the stock level.

From the repo root, with SENSEI_DATASET set to the dataset folder (as for agents/predict.py):

    python -I agents/train/train_r3.py deploy                    # every labelled photo of eval/labels.json
    python -I agents/train/train_r3.py forward --labels <file>   # earlier photos -> each camera's last 2 photos
    options: --labels PATH (default eval/labels.json), --seed 0, --epochs 6 (1 = smoke test), --device cuda|cpu,
             --threads 4 (CPU), --tag ld6ee, --out agents/train/out

deploy  writes the files agents/ loads, with the same names and layout, under --out:
          models/stock_4e/deploy/onepass_s224_<tag>.pt            fine-tuned DINOv2-S + stock head (fp32)
          models/stock_4e/deploy/onepass_s224_<tag>_fp16.pt       the same in fp16: agents/ ships this as <tag>.pt
          models/stock_4e/deploy/onepass_s224_<tag>.json          preprocessing, decision rules, area -> family
          models/stock_4e/deploy/onepass_s224_<tag>_product.npz   product head on block 8
          models/stock_4e/deploy/dinov2_small_config.json         backbone config (inference builds it offline)
          models/onepass/deploy/stockb8.npz                       block-8 stock head, averaged 1:1 with the stock head
forward writes <out>/forward_R3_s<seed>.json: R3's answers for the forward test photos of
        eval/benchmark/forward.json, from a model trained on every other labelled photo. Score it with
        python eval/benchmark.py forward <file>.

Recipe, fixed before any result (André's working copy: models/stock_4e/fx_deploy.py and fx_onepass_v3.py; the block-8
stock head is -b7's models/forward_b7/b8_stock_head.py, deployed by -d1's models/freehead_d1/train_deploy.py):
- crop: common.rectify(photo, area, size=(224, 224), expand_depth="auto", expand_front="auto"), the whole crate, as
  agents/ crops at prediction time;
- stock: facebook/dinov2-small with blocks 9-12 and the final layernorm trainable, a linear head on [CLS, mean patch];
  6 epochs, AdamW (weight decay 0.05), lr 2e-5 (head 1e-3), one-cycle with 15% warm-up, batch 32, label smoothing 0.05,
  fp16 autocast on GPU; augmentation: horizontal flip, brightness/contrast, shift of up to 8 px; seed s -> 1000 * s;
- product: logistic regression (C=0.1) on the standardised [CLS, mean patch] of block 8 (frozen, so pretrained);
  classes = planned family / EMPTY / WRONG; compliant iff P(planned family) + P(EMPTY) >= 0.5;
- block-8 stock head: logistic regression (C=0.03) on the same features, classes empty / half / full;
- stock answer: the two stock heads' probabilities averaged 1:1, then the level with the most expected points.
Night-curtain photos (6383 and 6386 at 06:12) are never trained on; agents/ answers them empty + compliant.
"""
import argparse
import json
import pathlib
import sys
import time

import numpy as np
import torch
from sklearn.linear_model import LogisticRegression

HERE = pathlib.Path(__file__).resolve().parent
AGENTS = HERE.parent
REPO = AGENTS.parent
sys.path.insert(0, str(AGENTS))
sys.path.insert(0, str(HERE))
from common import CURTAIN_PHOTOS, areas_by_id, list_images, load_image, load_planogram, rectify  # noqa: E402
from comp_catalog import cgroup  # noqa: E402

HUB = "facebook/dinov2-small"
SIZE = 224
LEVELS = (0.0, 0.5, 1.0)
NAMES = ("empty", "half", "full")
PAY = np.array([[1, -2, -2], [-3, 1, -2], [-3, -3, 1]], float)   # points: rows = answer, columns = truth
MEAN = torch.tensor([0.485, 0.456, 0.406]).view(1, 3, 1, 1)
STD = torch.tensor([0.229, 0.224, 0.225]).view(1, 3, 1, 1)


def crate_crops(cache):
    """Every area of every photo as a 224 px whole-crate crop, in (camera, time, planogram) order.
    Cached in <cache>/crops_crate224.npz; delete it when the photos change."""
    f = cache / "crops_crate224.npz"
    if f.exists():
        d = np.load(f)
        return d["X"], d["area_id"], d["ts"]
    t0 = time.time()
    pg = load_planogram()
    X, aid, ts = [], [], []
    photos = list_images()
    for r in photos:
        img = load_image(r.path)
        for a in pg[r.cam]:
            X.append(np.asarray(rectify(img, a, size=(SIZE, SIZE), expand_depth="auto", expand_front="auto")))
            aid.append(a["area_id"])
            ts.append(int(r.ts))
    X, aid, ts = np.stack(X), np.array(aid), np.array(ts)
    cache.mkdir(parents=True, exist_ok=True)
    np.savez(f, X=X, area_id=aid, ts=ts)
    print(f"crops: {len(X)} areas of {len(photos)} photos in {time.time() - t0:.0f} s -> {f}", flush=True)
    return X, aid, ts


def read_labels(path, aid, ts):
    """Per crop: stock class (0/1/2), compliant (1/0) and product-head target; -1 / "" where the label file has no
    answer and on the night-curtain photos (never trained on)."""
    key = json.loads(pathlib.Path(path).read_text(encoding="utf-8"))
    A = areas_by_id()
    planned = np.array([cgroup(A[x]["product_id"]) for x in aid])
    y, comp = np.full(len(aid), -1), np.full(len(aid), -1)
    tgt = np.array([""] * len(aid), dtype=object)
    for i, (x, t) in enumerate(zip(aid, ts)):
        c, f = x.split("_")[0], f"{int(t)}.jpg"
        r = key.get(c, {}).get(f, {}).get(x)
        if r is None or CURTAIN_PHOTOS.get(c) == f:
            continue
        y[i] = LEVELS.index(float(r["stock_value"]))
        comp[i] = int(bool(r["planogram_compliant"]))
        tgt[i] = "WRONG" if not comp[i] else ("EMPTY" if float(r["stock_value"]) == 0 else planned[i])
    return y, comp, tgt, planned


class Net(torch.nn.Module):
    """DINOv2-S with the last `blocks` blocks and the final layernorm trainable, and a linear stock head."""

    def __init__(self, blocks=4):
        super().__init__()
        from transformers import AutoModel
        self.bb = AutoModel.from_pretrained(HUB)
        for p in self.bb.parameters():
            p.requires_grad = False
        for blk in self.bb.encoder.layer[-blocks:]:
            for p in blk.parameters():
                p.requires_grad = True
        for p in self.bb.layernorm.parameters():
            p.requires_grad = True
        self.head = torch.nn.Linear(2 * self.bb.config.hidden_size, 3)

    def forward(self, x, with_b8=False):
        out = self.bb(pixel_values=x, output_hidden_states=with_b8)
        h = out.last_hidden_state
        logits = self.head(torch.cat([h[:, 0], h[:, 1:].mean(1)], 1))
        if not with_b8:
            return logits
        h8 = out.hidden_states[8]   # output of block 8: frozen, so the pretrained features
        return logits, torch.cat([h8[:, 0], h8[:, 1:].mean(1)], 1)


def batches(X, idx, bs, train, gen, shift=8):
    order = gen.permutation(idx) if train else idx
    for s in range(0, len(order), bs):
        b = order[s:s + bs]
        x = torch.from_numpy(X[b]).permute(0, 3, 1, 2).float() / 255.0
        if train:   # light augmentation: flip, brightness/contrast, small shift
            if gen.random() < 0.5:
                x = x.flip(3)
            x = (x - 0.5) * float(gen.uniform(0.85, 1.15)) + 0.5 + float(gen.uniform(-0.08, 0.08))
            dx, dy = gen.integers(-shift, shift + 1, size=2)
            x = torch.roll(x, shifts=(int(dy), int(dx)), dims=(2, 3))
        yield b, ((x.clamp(0, 1) - MEAN) / STD)


def finetune(X, y, rows, seed, epochs, dev):
    torch.manual_seed(1000 * seed)
    gen = np.random.default_rng(1000 * seed)
    net = Net().to(dev)
    params = [{"params": [p for p in net.bb.parameters() if p.requires_grad], "lr": 2e-5},
              {"params": net.head.parameters(), "lr": 1e-3}]
    opt = torch.optim.AdamW(params, weight_decay=0.05)
    steps = epochs * ((len(rows) + 31) // 32)
    sched = torch.optim.lr_scheduler.OneCycleLR(opt, max_lr=[2e-5, 1e-3], total_steps=steps, pct_start=0.15)
    amp = dev == "cuda"
    scaler = torch.amp.GradScaler(enabled=amp)
    yt = torch.from_numpy(y).long()
    t0 = time.time()
    net.train()
    for ep in range(epochs):
        for b, x in batches(X, rows, 32, True, gen):
            with torch.autocast(dev, dtype=torch.float16, enabled=amp):
                loss = torch.nn.functional.cross_entropy(net(x.to(dev)), yt[b].to(dev), label_smoothing=0.05)
            opt.zero_grad(set_to_none=True)
            scaler.scale(loss).backward()
            scaler.step(opt)
            scaler.update()
            sched.step()
        print(f"epoch {ep + 1}/{epochs}: last batch loss {loss.item():.3f} ({time.time() - t0:.0f} s)", flush=True)
    net.eval()
    return net, gen


def logistic(F, target, C):
    mu, sd = F.mean(0), F.std(0) + 1e-6
    return mu, sd, LogisticRegression(C=C, max_iter=3000).fit((F - mu) / sd, target)


def proba(head, F):
    mu, sd, m = head
    return m.predict_proba((F - mu) / sd)


def p_ok(Q, classes, planned):
    cls = list(classes)
    return np.array([(q[cls.index(f)] if f in cls else 0.0) + (q[cls.index("EMPTY")] if "EMPTY" in cls else 0.0)
                     for q, f in zip(Q, planned)])


def deploy(a, X, aid, ts, dev):
    y, comp, tgt, planned = read_labels(a.labels, aid, ts)
    tr = np.where(y >= 0)[0]
    print(f"deploy: {len(tr)} labelled areas from {a.labels}", flush=True)
    net, gen = finetune(X, y, tr, a.seed, a.epochs, dev)
    F = []
    with torch.no_grad():   # block-8 features in fp32, as on the CPU at prediction time
        for b, x in batches(X, tr, 64, False, gen):
            F.append(net(x.to(dev), with_b8=True)[1].float().cpu().numpy())
    F = np.concatenate(F)
    sd_ = {k: v.detach().float().cpu() for k, v in net.state_dict().items()}
    mu, sd, lr = logistic(F, tgt[tr].astype(str), 0.1)
    F64 = F.astype(np.float64)
    mu8, sd8, lr8 = logistic(F64, y[tr], 0.03)
    dep = pathlib.Path(a.out) / "models" / "stock_4e" / "deploy"
    dep.mkdir(parents=True, exist_ok=True)
    stem = dep / f"onepass_s{SIZE}_{a.tag}"
    torch.save(sd_, f"{stem}.pt")
    torch.save({k: v.half() for k, v in sd_.items()}, f"{stem}_fp16.pt")
    net.bb.config.to_json_file(str(dep / "dinov2_small_config.json"))
    np.savez(f"{stem}_product.npz", mu=mu.astype(np.float32), sd=sd.astype(np.float32), coef=lr.coef_.astype(np.float32),
             intercept=lr.intercept_.astype(np.float32), classes=np.array(lr.classes_))
    A = areas_by_id()
    meta = dict(
        backbone=HUB, input_size=SIZE, trained_on=pathlib.Path(a.labels).name, n_train_areas=int(len(tr)),
        trainable="encoder.layer[8:12] + layernorm + head (Linear 768->3 on [CLS, mean patch] of the last layer)",
        crop="common.rectify(img, area, size=(SIZE, SIZE), expand_depth='auto', expand_front='auto') (training crops: "
             "rectify at 224 then cv2.resize INTER_AREA to SIZE)",
        normalise=dict(mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225], scale="RGB uint8 / 255"),
        product_head="block-8 output (hidden_states[8]) -> [CLS, mean patch] (768) -> (x - mu) / sd -> softmax(x @ coef.T + intercept)",
        decide_product="compliant iff P(planned family) + P('EMPTY') >= 0.5 (classes: families, 'EMPTY', 'WRONG')",
        decide_stock="softmax of the stock head = [p_empty, p_half, p_full]; level = argmax of PAY @ p with "
                     "PAY = [[1,-2,-2],[-3,1,-2],[-3,-3,1]] (rows: predicted empty/half/full)",
        curtain="night-curtain photos (6383/6386 at 06:12) are answered empty + compliant by predict.py",
        planned_family={x: cgroup(A[x]["product_id"]) for x in sorted(A)})
    pathlib.Path(f"{stem}.json").write_text(json.dumps(meta, indent=1), encoding="utf-8")
    b8 = pathlib.Path(a.out) / "models" / "onepass" / "deploy" / "stockb8.npz"
    b8.parent.mkdir(parents=True, exist_ok=True)
    np.savez(b8, mu=mu8.astype(np.float32), sd=sd8.astype(np.float32), coef=lr8.coef_.astype(np.float32),
             intercept=lr8.intercept_.astype(np.float32), classes=lr8.classes_, labels=pathlib.Path(a.labels).name)
    print(f"wrote {stem}.pt, _fp16.pt, .json, _product.npz ({len(lr.classes_)} product classes), "
          f"{dep / 'dinov2_small_config.json'} and {b8}")


def forward(a, X, aid, ts, dev):
    y, comp, tgt, planned = read_labels(a.labels, aid, ts)
    split = json.loads((REPO / "eval" / "benchmark" / "forward.json").read_text(encoding="utf-8"))["test"]
    test = np.array([f"{int(t)}.jpg" in split.get(x.split("_")[0], []) for x, t in zip(aid, ts)])
    cur = np.array([CURTAIN_PHOTOS.get(x.split("_")[0]) == f"{int(t)}.jpg" for x, t in zip(aid, ts)])
    tr = np.where(~test & (y >= 0))[0]
    te = np.where(test & ~cur)[0]
    print(f"forward: {len(tr)} training areas from {a.labels}, {len(te)} test areas "
          f"({int(test.sum())} on {len({(x.split('_')[0], t) for x, t in zip(aid[test], ts[test])})} photos)", flush=True)
    net, _ = finetune(X, y, tr, a.seed, a.epochs, dev)
    rows = np.where(~cur)[0]
    F, P = np.zeros((len(aid), 2 * net.bb.config.hidden_size), np.float32), np.zeros((len(aid), 3))
    with torch.no_grad(), torch.autocast(dev, dtype=torch.float16, enabled=dev == "cuda"):
        for s in range(0, len(rows), 64):
            b = rows[s:s + 64]
            x = (torch.from_numpy(X[b]).permute(0, 3, 1, 2).float() / 255.0 - MEAN) / STD
            logits, f8 = net(x.to(dev), with_b8=True)
            F[b] = f8.float().cpu().numpy()
            P[b] = torch.softmax(logits.float(), 1).cpu().numpy()
    trc = np.where(~test & (comp >= 0))[0]
    head = logistic(F[trc], tgt[trc].astype(str), 0.1)
    ok = p_ok(proba(head, F[te]), head[2].classes_, planned[te])
    F64 = F.astype(np.float64)
    P8 = proba(logistic(F64[tr], y[tr], 0.03), F64[te])
    PS = (np.round(P[te], 4) + P8) / 2   # R3 = the one-pass p_stock (as written, 4 decimals) and the block-8 head, 1:1
    out = {}
    for i in np.where(test)[0]:
        c, f = aid[i].split("_")[0], f"{int(ts[i])}.jpg"
        out.setdefault(c, {}).setdefault(f, {})[aid[i]] = dict(planogram_compliant=True, stock_level="empty", stock_value=0.0)
    for j, i in enumerate(te):
        lv = int(np.argmax(PAY @ PS[j]))
        out[aid[i].split("_")[0]][f"{int(ts[i])}.jpg"][aid[i]] = dict(
            planogram_compliant=bool(ok[j] >= 0.5), stock_level=NAMES[lv], stock_value=LEVELS[lv],
            p_stock=[round(float(v), 4) for v in PS[j]])
    path = pathlib.Path(a.out) / f"forward_R3_s{a.seed}.json"
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(out, indent=1), encoding="utf-8")
    print(f"wrote {path}")


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("mode", choices=("deploy", "forward"))
    ap.add_argument("--labels", default=str(REPO / "eval" / "labels.json"))
    ap.add_argument("--seed", type=int, default=0)
    ap.add_argument("--epochs", type=int, default=6)
    ap.add_argument("--device", default="cuda" if torch.cuda.is_available() else "cpu")
    ap.add_argument("--threads", type=int, default=4)
    ap.add_argument("--tag", default="ld6ee")
    ap.add_argument("--out", default=str(HERE / "out"))
    a = ap.parse_args()
    torch.set_num_threads(a.threads)
    t0 = time.time()
    X, aid, ts = crate_crops(HERE / "cache")
    (deploy if a.mode == "deploy" else forward)(a, X, aid, ts, a.device)
    print(f"done in {time.time() - t0:.0f} s on {a.device}")


if __name__ == "__main__":
    main()
