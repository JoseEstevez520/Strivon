# agents/: image-only predictor (one-pass DINOv2-S, round-2 recipe R3) + label-free mode

## How to run (for graders)

From the repo root, with Python 3.12 or newer (tested on Windows with Python 3.12 and 3.14, CPU only):

```
python -m pip install -r agents/requirements.txt
python -I agents/predict.py --images <validation photo folder> --planogram <planogram.json> --out predictions.json
```

**Keep each photo in a folder named after its camera (`6215/1751…jpg`, as in the training set), or put the camera id
in the file name.** If the photos are all in one flat folder with timestamp-only names, the predictor cannot tell the
cameras apart on its own. Then also set `SENSEI_DATASET` to the challenge dataset folder (details below). Without it
the run stops with an ERROR and writes no file.

- Nothing is downloaded after the install: every weight is in this repo.
- Always pass `--images`, `--planogram` and `--out`; their defaults point at our own folders. `--planogram` can be
  left out only if `SENSEI_DATASET` points at the dataset folder (the one holding `Frutas e Legumes (train & test)/`
  and `planogram.json`).
- Photo layout:
  - `<camera id>/<file>.jpg` (like the training set), or folder or file names holding the camera id (`camera_6215/`,
    `6215_<timestamp>.jpg`): works as is, with the same answers with or without `SENSEI_DATASET`.
  - A flat folder of timestamp-only names: also set `SENSEI_DATASET`, so each photo's camera is recognised by
    comparing it with the training photos. Without it the run stops with an ERROR; it never guesses.
- Threads: `ONEPASS_THREADS` (default 4). The answers are identical at any thread count; `ONEPASS_THREADS=1` uses
  about 2.3 times less CPU and takes about twice as long.
- The last line starts with `OK` (exit code 0) when everything is fine; an option that is on is named in brackets,
  e.g. `OK (stock model mix): ...`. `FALLBACKS` (2), `INCOMPLETE` (3) or `INVALID` (1): read the WARN lines above it.

## Details

Reads `<camera>/<timestamp>.jpg` (or a flat folder) and writes predictions in the `annotations.json` format.
Each photo is judged on its own pixels only. One DINOv2-S pass per planogram area gives:

- the product check: a logistic head on block 8;
- the stock level: the fine-tuned head, averaged 1:1 with a free logistic stock head on the same block-8 features
  (`models/onepass/deploy/stockb8.npz`), then the best-expected-points level.

The weights were trained on every photo of `eval/labels.json` at commit d6eeba4 (curtain photos left out). They are
224 px and stored in fp16; on all 181 photos that gives the same answers as fp32. By default the stock heads are the
label-mix version, `ld6ee_mix` (`--stock-model mix`, below); `--stock-model ld6ee` runs the earlier ones.

From the repo root, with `SENSEI_DATASET` set to the dataset folder:

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

**Store strictness** (Sensei's suggestion: stores differ on what "empty" means). `--stock-mode NAME` weights the
averaged stock probabilities before the best-expected-points level: p(empty) x E and p(full) x F. `sensei` (the
default, E = F = 1) gives the validated answers byte for byte; `empty-only-when-bare` (E = 0.4) says empty only when
nothing is left; `empty-at-a-few` (E = 2.5) also calls a crate with a few units empty; `strict-full` (F = 0.5) says
full only when it really is. `--empty-weight E` / `--full-weight F` set them by hand. It works with both stock models.
The presets are not scored claims: the run prints a WARN and the last line names the mode, e.g.
`OK (stock model mix, mode empty-at-a-few)`.

## Calibration (app)

"Empty" depends on the product and the person: one melon left may be empty for one store and half for another. The
app's calibration panel lets each user set, per product, a fill level (a % slider, or a 0-7 count for big items like
melons) and press full / half / empty. It writes `calib.json`; `--calibration calib.json` makes the predictor follow it.

- Fill estimate per area: fill % = 100 x (0.5 x p_half + p_full), from the same averaged stock probabilities the
  default decision uses. `--fill-out fill.json` writes it next to the normal output, as
  `{camera: {image: {area: {"fill_pct": x, "units": y or null}}}}`; units only for count products,
  round(fill % / 100 x capacity). The submission file never changes.
- Contract (version 1):
  `{"version": 1, "products": {"<product_id>": {"unit": "percent" | "count", "capacity": 7, "points": [{"value": 25,
  "level": "full"}, ...], "empty_max": n | null, "full_min": n | null}}}`. Product ids are the planogram's.
- Per area, the slot's planogram product decides: empty if fill <= empty_max, full if fill >= full_min, else half
  (count products compare whole units). empty_max / full_min come from the file, else from its points (the highest
  point labelled empty, the lowest labelled full), else 30 % / 74 % (-38's global fit, which reproduces the default
  answers almost exactly; count: round(0.30 x capacity) / round(0.74 x capacity)); with only full points empty_max =
  round(full_min x 30 / 74), with only empty points full_min = min(cap, round(empty_max x 74 / 30)), cap = 100 or the
  capacity, so "25 % = full" alone gives empty <= 10 %. Rounding is floor(x + 0.5). Units are floor(fill % / 100 x
  capacity + 0.5). A product whose empty_max >= full_min is refused; a half point outside (empty_max, full_min) gets a
  WARN; a product id not in the planogram gets a WARN and is ignored. Products not in the file keep the default
  answers. Night-curtain and fallback areas are never calibrated (fill_pct is null there), and compliance never
  changes.
- The run prints a WARN with each product's thresholds and how many answers it changed; the last line names it, e.g.
  `OK (stock model mix, calibration calib.json)`. For now it can't be combined with `--stock-mode`, `--stock-tilt` or
  `--label-free`. Without `--calibration` the answers are exactly the default ones.

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
