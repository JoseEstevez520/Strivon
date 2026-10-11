# agents/: image-only predictor (one-pass DINOv2-S, round-2 recipe R3) + label-free mode

Reads `<camera>/<timestamp>.jpg` (or a flat folder) and writes predictions in the `annotations.json` format.
Each photo is judged on its own pixels only. One DINOv2-S pass per planogram area gives:

- the product check: a logistic head on block 8;
- the stock level: the fine-tuned head, averaged 1:1 with a free logistic stock head on the same block-8 features
  (`models/onepass/deploy/stockb8.npz`), then the best-expected-points level.

The weights were trained on every photo of `eval/labels.json` at commit d6eeba4 (curtain photos left out). They are
224 px and stored in fp16; on all 181 photos that gives the same answers as fp32. By default the stock heads are the
label-mix version, `ld6ee_mix` (`--stock-model mix`, below); `--stock-model ld6ee` runs the earlier ones.

From the repo root, with `SENSEI_DATASET` set to our dataset folder:

```
python -I agents/predict.py --images <photo folder> --planogram <planogram.json> --out predictions.json --expect-images 26 --expect-areas 289
python -I agents/submission/validate.py predictions.json --images <photo folder> --planogram <planogram.json>
```

The last line of predict.py must say `OK (stock model mix): <n> areas ... single image (submission mode)`. Anything
else means stop and read the WARN lines:

- `INVALID` (exit 1): the output breaks the format.
- `FALLBACKS` (exit 2): some answers did not come from the model (a model failed or a photo could not be read).
- `INCOMPLETE` (exit 3): the photo or area count differs from `--expect-images` / `--expect-areas`, or files were
  left out. Those are photos of no planogram camera, files that can't be read or recognised, and formats other than
  .jpg/.jpeg/.png.

On the day, check by eye that every photo was assigned to the right camera: read the "camera ... taken from" and
"recognised as" WARN lines.

`--stock-model ld6ee --stock-tilt K` (opt-in, off by default) is a "lower when unsure" hedge on the earlier model:
p(full) is multiplied by K (0 < K <= 1) before the best-expected-points level, so "full" needs more confidence. Only
full answers can change: to half, or to empty when 4 p_empty > 3 p_half. With K = 1 the answers are exactly
`--stock-model ld6ee`'s. With it, the last line starts with `OK (stock tilt k=<K>)`. For checks, `--p-stock-out
<file>` also writes the answers plus each area's p_stock (before the tilt) to another file; never send that one.

`--stock-model mix` is the default (André's choice, 11 Oct): the R3 recipe retrained with -38's label mix
(`agents/train`, `--mix-silver`): both stock heads learn 0.75 x our label + 0.125 x each of the two Sensei-wording
passes in `lab/silver2`; the product head stays on our labels. Its weights
(`models/stock_4e/deploy/onepass_s224_ld6ee_mix.*`) and its own block-8 head
(`models/onepass/deploy/stockb8_ld6ee_mix.npz`) are used together (env: `ONEPASS_TAG=ld6ee_mix` and
`ONEPASS_B8_HEAD=<that .npz>`; with the tag alone, onepass.py also picks the tag's own head; if either env var is set
by hand, predict.py leaves them alone). It can't be combined with `--stock-tilt` (never validated together), and the
last line starts with `OK (stock model mix)`. `--stock-model ld6ee` gives the model before it.

How the camera is found, in order:

1. a folder named like a camera (`6215/`);
2. a folder or file name holding exactly one camera id (`camera_6215/`, `6215_photos/`, `6215_<ts>.jpg`);
3. appearance, which needs `SENSEI_DATASET` and a clear match (score >= 0.5, margin >= 0.10 over the next camera).

A photo of another size is resized to 1280x720 with a WARN. A view shifted more than 10 px against our photos of that
camera gives a warn-only WARN. Neither check ever changes an answer.

- Works offline and without `transformers`: the DINOv2-S backbone is `models/stock_4e/dinov2_lite.py` (from Jose's
  lab: the same modules and operations as `transformers`' `Dinov2Model`, same answers byte for byte on all 181
  photos), built from `deploy/dinov2_small_config.json`. Every weight comes from the .pt.
- Speed: about 1 s per photo on a laptop CPU (4 threads), 0.08 s on an RTX 3060 Laptop GPU, 0.7 GB RAM, ~3 s
  start-up (it was ~12 s and 1.0 GB while transformers was imported). Env vars: `ONEPASS_DEVICE=cuda`,
  `ONEPASS_THREADS=4`, `ONEPASS_SIZE=224`, `ONEPASS_TAG`, `ONEPASS_B8_HEAD=off`.

## Label-free mode (pitch / new-store path, zero labels; not the submission)

`--label-free` swaps in a model that uses no labels at all:

- product: SigLIP2-base zero-shot over the camera's product families, plus EMPTY;
- stock: one SigLIP2-base pass over the whole crate at 336 px, MAP-pooled into 3x3 regions. It counts the share of
  regions that look like empty floor, minus a per-area baseline (candidate U7).

The baseline is the area's minimum share over a set of unlabelled photos of the store, built once.

```
python -I agents/labelfree_setup.py weights        # once, WITH internet, before the day: 1.5 GB download (HF_HOME), sha256-checked
                                                   # (--out <path>.pt writes the 186 MB weights elsewhere; then set LABELFREE_WEIGHTS=<path>)
python -I agents/predict.py --label-free --images <photo folder> --planogram <planogram.json> --out predictions_lf.json
python -I agents/labelfree_setup.py baselines --images <unlabelled photos of a new store> --out <store>.json   # new store
```

- The shipped baselines come from our 179 unlabelled non-curtain photos.
- `LABELFREE_BASELINES=<store>.json` uses a new store's baselines.
- predict refuses (ERROR) to judge any photo the baselines were built from. `--allow-baseline-overlap` lifts that for
  evaluation only.
- Without the weights it stops with an ERROR naming the setup command. `LABELFREE_WEIGHTS=<path>.pt` uses a copy of
  the weights stored elsewhere, read-only.
- Speed: ~0.2 s per photo on an RTX 3060 Laptop GPU, ~8 s per photo on a laptop CPU (4 threads).
- Score with zero labels (all points, rules' table, team key): +1906 / 3858 on all 1929 labelled areas, +240 / 604 on
  each camera's last 2 photos. The supervised model scores +483 / 604 on those last photos.

Needs Python 3.12+, torch, numpy, opencv-python and pillow (see requirements.txt). `transformers` is only needed by
`--label-free` (SigLIP2) and `labelfree_setup.py`. Not included: the challenge data (planogram, photos, labels). Pass
them in with the flags above.
