"""Fine-tuned DINOv2-small on the whole crate, one pass per crate: stock and product check.

A reproduction, in our pipeline, of André's best cheap model ("agents_img_one_pass", 3349 on the
benchmark), from the settings he published in LEADERBOARD.md, so anyone on the team can run it:

- input: the hand-drawn crate (backend/sensei/crates.json) warped to 224 x 224;
- DINOv2-small, last 4 blocks fine-tuned, 6 epochs, lr 2e-5 (head 1e-3), label smoothing 0.05,
  flip / brightness / shift augmentation;
- stock: a linear head on the final CLS token plus a small learned embedding of the area id
  (several areas can share one crate);
- product: logistic regression on the frozen block-8 CLS token plus the area id, read from the same
  forward pass;
- decision: the level with the most expected points (no tuning on the benchmark).

Only the photo under analysis is used. Commands:
    python -m sensei dino-bench     # André's 5 folds -> eval/benchmark/preds/dino_s_crate.json
    python -m sensei dino-train     # fit on eval/labels.json -> outputs/dino_s.pt
"""
from __future__ import annotations

import json
import os
import time
from pathlib import Path

import cv2
import numpy as np

from . import config
from .decision import decide_stock
from .extract import crate_quads, discover
from .geometry import rectify
from .planogram import load_planogram

ARCH = "vit_small_patch14_dinov2.lvd142m"
SIZE = 224
EPOCHS = int(os.environ.get("SENSEI_DINO_EPOCHS", 6))
LIDX = {"empty": 0, "half": 1, "full": 2}
LEVELS = ["empty", "half", "full"]
MODEL_PATH = config.OUTPUTS_DIR / "dino_s.pt"
MEAN = np.array([0.485, 0.456, 0.406], np.float32)
STD = np.array([0.229, 0.224, 0.225], np.float32)


def _threads():
    import torch

    torch.set_num_threads(int(os.environ.get("SENSEI_THREADS", max(1, (os.cpu_count() or 4) - 2))))


def crate_crops(refs, pg):
    """{(camera, image, crate_key): uint8 RGB 224x224}, one crop per distinct crate quad."""
    cq = crate_quads()
    out, area_crate = {}, {}
    for r in refs:
        img = cv2.imread(str(r.path))
        if img.shape[1::-1] != config.IMAGE_SIZE:
            img = cv2.resize(img, config.IMAGE_SIZE)
        for a in pg.cameras[r.camera]:
            q = cq.get(a.area_id, a.quad)
            ck = tuple(np.round(q).astype(int).ravel())
            area_crate[a.area_id] = ck
            if (r.camera, r.name, ck) not in out:
                c, _ = rectify(img, q, (SIZE, SIZE))
                out[(r.camera, r.name, ck)] = cv2.cvtColor(c, cv2.COLOR_BGR2RGB)
    return out, area_crate


def _tensor(batch_rgb, train: bool, rng):
    import torch

    xs = []
    for im in batch_rgb:
        x = im.astype(np.float32) / 255.0
        if train:
            if rng.random() < 0.5:
                x = x[:, ::-1]
            x = np.clip(x * rng.uniform(0.8, 1.2) + rng.uniform(-0.06, 0.06), 0, 1)
            dx, dy = rng.integers(-12, 13, size=2)
            x = np.roll(x, (dy, dx), axis=(0, 1))
        xs.append(((x - MEAN) / STD).transpose(2, 0, 1))
    return torch.from_numpy(np.ascontiguousarray(np.stack(xs)))


class Net:
    def __init__(self, n_areas: int):
        import timm
        import torch

        self.torch = torch
        self.backbone = timm.create_model(ARCH, pretrained=True, img_size=SIZE, num_classes=0)
        for p in self.backbone.parameters():
            p.requires_grad = False
        for b in self.backbone.blocks[-4:]:
            for p in b.parameters():
                p.requires_grad = True
        for p in self.backbone.norm.parameters():
            p.requires_grad = True
        self.area_emb = torch.nn.Embedding(n_areas, 16)
        self.head = torch.nn.Linear(384 + 16, 3)
        self._b8 = None
        self.backbone.blocks[7].register_forward_hook(lambda m, i, o: setattr(self, "_b8", o[:, 0].detach()))

    def params(self):
        return [{"params": [p for p in self.backbone.parameters() if p.requires_grad], "lr": 2e-5},
                {"params": list(self.area_emb.parameters()) + list(self.head.parameters()), "lr": 1e-3}]

    def forward(self, x, area_idx):
        f = self.backbone(x)
        return self.head(self.torch.cat([f, self.area_emb(area_idx)], 1)), self._b8

    def train_mode(self, on: bool):
        for m in (self.backbone, self.area_emb, self.head):
            m.train(on)

    def state(self):
        return {"backbone": self.backbone.state_dict(), "area_emb": self.area_emb.state_dict(), "head": self.head.state_dict()}

    def load(self, st):
        self.backbone.load_state_dict(st["backbone"])
        self.area_emb.load_state_dict(st["area_emb"])
        self.head.load_state_dict(st["head"])


def fit(rows, crops, area_index, log=print, seed=0):
    """rows: list of (crop_key, area_id, stock_idx, compliant)."""
    import torch

    _threads()
    torch.manual_seed(seed)
    rng = np.random.default_rng(seed)
    net = Net(len(area_index))
    opt = torch.optim.AdamW(net.params(), weight_decay=0.05)
    lossf = torch.nn.CrossEntropyLoss(label_smoothing=0.05)
    bs = 32
    t0 = time.time()
    for ep in range(EPOCHS):
        net.train_mode(True)
        order = rng.permutation(len(rows))
        tot = 0.0
        for s in range(0, len(order), bs):
            b = [rows[j] for j in order[s:s + bs]]
            x = _tensor([crops[r[0]] for r in b], True, rng)
            ai = torch.tensor([area_index[r[1]] for r in b])
            y = torch.tensor([r[2] for r in b])
            logits, _ = net.forward(x, ai)
            loss = lossf(logits, y)
            opt.zero_grad()
            loss.backward()
            opt.step()
            tot += float(loss) * len(b)
        if log:
            log(f"    epoch {ep + 1}/{EPOCHS} loss {tot / len(rows):.3f} ({time.time() - t0:.0f}s)")
    # product head: logistic regression on frozen block-8 CLS + area id (no augmentation)
    feats = embed(net, [r[0] for r in rows], [r[1] for r in rows], crops, area_index)[1]
    net.product = _fit_product(feats, [r[1] for r in rows], np.array([r[3] for r in rows]), area_index)
    return net


def _area_onehot(areas, area_index):
    oh = np.zeros((len(areas), len(area_index)), np.float32)
    for i, a in enumerate(areas):
        oh[i, area_index[a]] = 1
    return oh


def _fit_product(f8, areas, yc, area_index):
    from sklearn.linear_model import LogisticRegression
    from sklearn.preprocessing import StandardScaler

    X = np.hstack([f8, _area_onehot(areas, area_index)])
    sc = StandardScaler().fit(X)
    if len(set(yc)) < 2:
        return (sc, None)
    return (sc, LogisticRegression(C=0.05, max_iter=3000).fit(sc.transform(X), yc))


def embed(net, keys, areas, crops, area_index, bs=64):
    """Stock probabilities and frozen block-8 features for (crop_key, area) pairs."""
    import torch

    net.train_mode(False)
    probs, f8 = [], []
    with torch.no_grad():
        for s in range(0, len(keys), bs):
            x = _tensor([crops[k] for k in keys[s:s + bs]], False, None)
            ai = torch.tensor([area_index[a] for a in areas[s:s + bs]])
            logits, b8 = net.forward(x, ai)
            probs.append(torch.softmax(logits, 1).numpy())
            f8.append(b8.numpy())
    return np.concatenate(probs), np.concatenate(f8)


def predict_rows(net, keys, areas, crops, area_index):
    ps, f8 = embed(net, keys, areas, crops, area_index)
    sc, lr = net.product
    if lr is None:
        pc = np.ones(len(keys))
    else:
        pc = lr.predict_proba(sc.transform(np.hstack([f8, _area_onehot(areas, area_index)])))[:, list(lr.classes_).index(1)]
    return ps, pc


def _decide(ps, pc):
    lvl, val, _ = decide_stock(ps)
    return {"planogram_compliant": bool(pc >= 0.5), "stock_level": lvl, "stock_value": val,
            "p_stock": [round(float(x), 4) for x in ps]}


def bench(log=print):
    import sys

    sys.path.insert(0, str(config.ROOT / "eval"))
    import benchmark as B

    pg = load_planogram()
    refs = discover(config.IMAGES_DIR, pg)
    crops, area_crate = crate_crops(refs, pg)
    area_index = {a.area_id: i for i, a in enumerate(pg.areas)}
    key = B.KEY
    out_path = config.ROOT / "eval" / "benchmark" / "preds" / "dino_s_crate.json"
    preds = json.loads(out_path.read_text()) if os.environ.get("SENSEI_DINO_RESUME") and out_path.exists() else {}
    for fold in range(5):
        train, test = B.train_test(fold)
        if any(c in preds and i in preds[c] for c, i in test):
            log(f"fold {fold}: already done")
            continue
        rows = [((c, i, area_crate[a]), a, LIDX[v["stock_level"]], int(v["planogram_compliant"]))
                for c, i in train for a, v in key.get(c, {}).get(i, {}).items()]
        log(f"fold {fold}: training on {len(rows)} areas")
        net = fit(rows, crops, area_index, log=log, seed=fold)
        tk = [(c, i, a.area_id) for c, i in test for a in pg.cameras[c]]
        ps, pc = predict_rows(net, [(c, i, area_crate[a]) for c, i, a in tk], [a for _, _, a in tk], crops, area_index)
        for k, p, q in zip(tk, ps, pc):
            preds.setdefault(k[0], {}).setdefault(k[1], {})[k[2]] = _decide(p, q)
        out_path.write_text(json.dumps(preds))
        t = B.tally({c: {i: v for i, v in imgs.items()} for c, imgs in preds.items()}, set(test))
        log(f"fold {fold}: {t['total']} / {t['max']} on its own photos")
    t = B.tally(preds)
    log(f"dino_s_crate: {t['total']} / {t['max']} (ident {t['ident']}, stock {t['stock']})")


def train(log=print):
    from .single import training_labels

    pg = load_planogram()
    refs = discover(config.IMAGES_DIR, pg)
    crops, area_crate = crate_crops(refs, pg)
    area_index = {a.area_id: i for i, a in enumerate(pg.areas)}
    labels = training_labels(log)
    rows = [((c, i, area_crate[a]), a, LIDX[v["stock_level"]], int(v["planogram_compliant"]))
            for (c, i, a), v in labels.items() if (c, i, area_crate.get(a)) in crops]
    log(f"training on {len(rows)} areas")
    net = fit(rows, crops, area_index, log=log)
    import pickle

    import torch

    MODEL_PATH.parent.mkdir(parents=True, exist_ok=True)
    torch.save({"state": net.state(), "product": pickle.dumps(net.product), "areas": list(area_index)}, MODEL_PATH)
    log(f"saved {MODEL_PATH}")


def load():
    if not MODEL_PATH.exists():
        return None
    import pickle

    import torch

    ck = torch.load(MODEL_PATH, weights_only=False)
    area_index = {a: i for i, a in enumerate(ck["areas"])}
    net = Net(len(area_index))
    net.load(ck["state"])
    net.product = pickle.loads(ck["product"])
    net.area_index = area_index
    return net


def predict(net, refs, pg) -> dict:
    """{(camera, image, area_id): (p_stock, p_compliant)} for the photos in `refs`."""
    _threads()
    crops, area_crate = crate_crops(refs, pg)
    tk = [(r.camera, r.name, a.area_id) for r in refs for a in pg.cameras[r.camera]]
    ps, pc = predict_rows(net, [(c, i, area_crate[a]) for c, i, a in tk], [a for _, _, a in tk], crops, net.area_index)
    return {k: (p, float(q)) for k, p, q in zip(tk, ps, pc)}
