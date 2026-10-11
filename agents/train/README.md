# agents/train: retrain R3, the model `agents/predict.py` ships

`train_r3.py` retrains the supervised one-pass model (weights tag `ld6ee`) from the photos and a label file. One
DINOv2-S pass over each area gives both answers, from the photo under analysis only. The recipe was fixed before any
result. It is ported unchanged from André's working copy:

- `fx_deploy.py`: the deploy model.
- `fx_onepass_v3.py --split forward`: the forward model.
- The block-8 stock head: -b7's `b8_stock_head.py`, deployed by -d1's `freehead_d1/train_deploy.py`.
- `comp_catalog.py`: a copy of the product → family map that the product head's classes use.

The recipe itself is in the docstring of `train_r3.py`.

## Commands

Run from the repo root, with `SENSEI_DATASET` set to the dataset folder (the same as for `agents/predict.py`).

```
# deploy: every labelled photo of eval/labels.json -> agents/train/out/...
python -I agents/train/train_r3.py deploy

# forward: train on all but each camera's last 2 photos (eval/benchmark/forward.json), answer those photos.
# R3 s0 of the forward table was trained on the labels at commit 1221ec3 (use --seed 1 for s1)
git show 1221ec3:eval/labels.json > labels_1221ec3.json   # needs the full history (not a --depth 1 clone)
python -I agents/train/train_r3.py forward --labels labels_1221ec3.json
python eval/benchmark.py forward agents/train/out/forward_R3_s0.json

# smoke test: 1 epoch
python -I agents/train/train_r3.py deploy --epochs 1
```

Options:

- `--labels PATH`: default `eval/labels.json`.
- `--seed 0`
- `--epochs 6`
- `--device cuda|cpu`
- `--threads 4`
- `--tag ld6ee`
- `--out agents/train/out`

`deploy` writes the files `agents/` loads, with the same names, under `--out`:

- `models/stock_4e/deploy/onepass_s224_<tag>.pt`: the fine-tuned backbone and stock head, fp32.
- `models/stock_4e/deploy/onepass_s224_<tag>_fp16.pt`: the same weights in fp16. `agents/` ships this file renamed to `onepass_s224_<tag>.pt`.
- `models/stock_4e/deploy/onepass_s224_<tag>.json`
- `models/stock_4e/deploy/onepass_s224_<tag>_product.npz`
- `models/stock_4e/deploy/dinov2_small_config.json`
- `models/onepass/deploy/stockb8.npz`

To use a retrained model:

1. Copy the `<tag>` files into `agents/models/stock_4e/deploy/`, renaming the fp16 file to `onepass_s224_<tag>.pt`.
2. Copy `stockb8.npz` into `agents/models/onepass/deploy/`, or point `ONEPASS_B8_HEAD` at it.
3. Set `ONEPASS_TAG=<tag>`.

`out/` and the crop cache in `cache/` are not committed. The cache holds the 224 px crops, about 300 MB; delete it when the photos change.

Requirements: `agents/requirements.txt`, plus a CUDA build of torch to train on a GPU.

## Label-mix option (`--mix-silver`)

`--mix-silver lab/silver2` trains both stock heads on soft targets: 0.75 x our label + 0.125 x each of the two
Sensei-wording passes in `lab/silver2` (N1 = `p3_*`, N2 = `p4_*`; a pass that skipped the area gives its share to the
other). This is -38's convention hedge, validated as `models/stock/sup_night.py --variant mix`. The product head stays
on our labels. Without the flag nothing changes: deploy is still bit-identical to `ld6ee`.

```
python -I agents/train/train_r3.py deploy --mix-silver lab/silver2 --tag ld6ee_mix
python -I agents/train/train_r3.py forward --labels labels_1d7b2ff.json --mix-silver lab/silver2   # -> out/forward_R3mix_s0.json
```

With the flag, deploy writes the block-8 head as `models/onepass/deploy/stockb8_<tag>.npz`, so it can't overwrite the
shipped `stockb8.npz`. To predict with the mix model, set BOTH `ONEPASS_TAG=<tag>` and
`ONEPASS_B8_HEAD=agents/models/onepass/deploy/stockb8_<tag>.npz`. With the tag alone, predict.py averages the mix
model with the shipped block-8 head (trained on our labels only), a pairing nobody validated.
`python agents/predict.py --stock-model mix` sets both (-d1); it refuses `--stock-tilt` below 1, a combination
that was never validated.

What it buys (stock points, mean of 2 seeds, against the same recipe on our labels; tables in eval/benchmark/preds_forward/hedge/README.md and docs/BOARD.md):
on the 5 benchmark folds (1947 areas), -51.5 on our labels and +89.8 on the mean of N1 and N2 (+85 where they
agree); on the forward split (302 areas), +1 on our labels (key 1221ec3) and +29 where N1 and N2 agree; on José's
lab's human reader key, +29 / +25. Part of the N1/N2 gain is self-fulfilling, since the model trained on those
labellers; the reader's key is the independent check.

Checked from a fresh clone (11 Oct 2026):

- The soft targets equal `sup_night.py`'s bit for bit, on labels d6eeba4 (657 soft rows) and 1d7b2ff (660 soft rows).
- `forward --labels labels_1d7b2ff.json --mix-silver lab/silver2` gives the same answers as -38's validated forward file on all 304 areas, for both product and stock. The largest `p_stock` difference is 0.0018.

## Time

- **GPU** (RTX 3060 Laptop, fp16 autocast): about 1 to 1.3 minutes per model end to end.
  - The 6 epochs take 43 to 51 s.
  - The crops take 6 s, the first time only.
- **CPU** (Ryzen 9 5900HS, 4 threads, fp32): about 35 to 40 minutes per model.
  - This is an estimate: one optimiser step of 32 crops takes 5.4 s and there are 366 steps, plus 98 ms per crop for the feature pass.
  - CPU training was not run to the end.
  - It trains in fp32, so its weights will not be bit-identical to a GPU run.

## Reproduction (11 Oct 2026, from a fresh clone of main)

**Setup:** `eval/labels.json` (= commit d6eeba4), seed 0, torch 2.11.0+cu128, RTX 3060 Laptop.

**Deploy, transformers 5.10.2** (the version `ld6ee` was trained with). The retrain is bit-identical to the shipped `ld6ee`:

- All 225 tensors of the fp32 weights match, and so does the fp16 file that `agents/` ships.
- The product head and the backbone config are identical.
- The only difference in the `.json` is `trained_on`, the label file's name. Name the label file `labels_d6eeba4.json` to match it too.
- `stockb8.npz` is numerically close (largest coefficient difference 0.0013). The shipped head was fitted on block-8 features computed in a separate pass. None of R3's answers on the 1962 areas change.

**Deploy, transformers 4.57.6** (what `agents/requirements.txt` installs). This is within seed noise:

- The fine-tuned blocks differ (largest weight difference 0.07).
- 2 of the 1962 stock answers change. Seed 1 changes 5. These answers are on all 181 photos, which the models were trained on.
- No product answer changes, because block 8 is frozen.

**Forward, seed 0, labels at 1221ec3:**

- The answers are identical to `eval/benchmark/preds_forward/agents_R3_s0.json` on all 304 areas, for both product and stock.
- The largest `p_stock` difference is 0.0043.
