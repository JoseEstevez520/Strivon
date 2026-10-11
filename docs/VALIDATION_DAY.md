# Validation day

## The submission: André's one-pass predictor (`agents/predict.py`)

Chosen on the forward split (`docs/BOARD.md`, 11 Oct 02:20 Lisbon): the R3 weights alone, with their own
product check, on one CPU thread. Rehearsed on Miguel's laptop on 11 Oct, 02:10, with André's retrained
weights (`ld6ee`, PR #84) on a copy of the 28 forward-split photos laid out as `<camera>/<timestamp>.jpg`:
`OK: 304 areas`, validator 0 errors, 2.0 CPU s per photo end to end on one thread (6.6 s start-up
included). The answers are the same with and without `SENSEI_DATASET`, a wrong `--expect-images` stops
with `INCOMPLETE` (exit 3) and a broken JPEG with `FALLBACKS` (exit 2). Traps:

1. The submission no longer imports `transformers`: its DINOv2 backbone is
   `agents/models/stock_4e/dinov2_lite.py` (Jose's lab; same answers byte for byte on all 181 photos), so the
   old 5.x trap (weights not loading, every area silently "full, compliant") cannot reach it. Only
   `--label-free` still uses `transformers` (`agents/requirements.txt` keeps it < 5). Whatever the cause, never
   send a file when the run ends with "!! ... FALLBACKS".
2. The predictor looks for the dataset under `agents/OfficialDataset/...`. If the data is elsewhere,
   point `SENSEI_DATASET` at a folder holding `Frutas e Legumes (train & test)/` and `planogram.json`.
3. **Always set `SENSEI_DATASET`, even if the data is in the default place.** If the validation photos
   don't come as `<camera id>/<timestamp>.jpg` (a flat folder, or folders named like `camera_6215/`), the
   predictor can only work out each photo's camera by comparing it with our photos. That needs `SENSEI_DATASET`.
   Without it, such a layout stops with an ERROR, which is loud, not silent.
4. The last line tells you what to do:
   - `OK` (exit 0): send the file.
   - `FALLBACKS` (exit 2): some answers did not come from the model, for example a corrupt photo. Don't send it.
   - `INCOMPLETE` (exit 3): the photo or area count doesn't match `--expect-*`, or files were skipped. Check before sending.
   - `INVALID` (exit 1): the file failed the format check.
5. Set `ONEPASS_THREADS=1`. The default is 4 threads, which gives the same answers (0 of 304 areas
   differ) for 2.3 times the CPU, and cost is 20% of the grade.

```bash
python -m pip install -r agents/requirements.txt
```

Run both commands from the repo root. In bash:

```bash
SENSEI_DATASET="PATH/TO/dataset" ONEPASS_THREADS=1 python -I agents/predict.py --images "PATH/TO/validation" --planogram data/planogram.json --out agents/submission/final.json --expect-images 26 --expect-areas 289
```

or in PowerShell:

```powershell
$env:SENSEI_DATASET = "PATH\TO\dataset"; $env:ONEPASS_THREADS = "1"; python -I agents/predict.py --images "PATH\TO\validation" --planogram data/planogram.json --out agents/submission/final.json --expect-images 26 --expect-areas 289
```

On Miguel's laptop `PATH/TO/dataset` is `outputs/dataset` (a link to `data/images` under the official
folder name, plus `planogram.json`).

Not chosen, kept for reference: the stock tilt, `--stock-model ld6ee --stock-tilt K` (e.g. `--stock-tilt 0.7`; with the default mix model predict.py refuses the tilt). It multiplies p(full) by K (0 < K <= 1) before the expected-points choice, so "full" needs more confidence, and the last line then starts with `OK (stock tilt k=0.7): 289 areas`. Only full answers can change, to half or (if 4·p_empty > 3·p_half) to empty; the product answers stay the same unless `--empty-rule` is also changed from its default.

The default is the mix model (André's choice, 11 Oct; the plain command above runs it, no flag needed): R3 retrained with stock labels mixed 0.75 ours + 0.25 Sensei-wording AI passes (`lab/silver2`), at the same cost; its weights and its own block-8 head are picked together, and the product head stays on our labels. It can't be combined with `--stock-tilt` (never validated together: predict.py stops with an error). `--stock-model ld6ee` gives the model before it.

The last line must start with `OK (stock model mix): 289 areas`. Then check the file against the photos it must cover (this one also notices a photo that is missing as a whole; the older
`validate_submission` check does not):

```bash
python -I agents/submission/validate.py agents/submission/final.json --images "PATH/TO/validation" --planogram data/planogram.json
```

It must say 26 images, 289 areas and 0 errors.

## Option: the lab model (`lab/predict_fast.py`)

The cheapest model, image only: about 0.1 s of CPU per photo, 103 MB, no GPU. Rehearsed on 11 Oct from a clean copy of main on 26 photos:
289 areas in 1.4 s, no warnings. Full usage in `lab/PREDICT.md`.

```bash
python lab/predict_fast.py predict --images "PATH/TO/validation" --model lab/models/lane_i_ens.pkl --out out/lab.json --threads 1 --expect-images 26 --expect-areas 289 --strict
```

- `lab/models/lane_i_ens.pkl` is not in git: it holds colour histograms of crops, which come from the challenge photos. Copy the file from the
  laptop that trained it, or rebuild it with `python lab/predict.py train --model ensemble --out lab/models/lane_i_ens.pkl` (needs `data/images`,
  the answer key and the first-run download of the MobileNetV3 weights; rebuilding from scratch on another laptop has not been rehearsed).
- Add `--p-stock` only to feed `combine`. A file written with it carries an extra `p_stock` key per area: send the output of `combine`, not that file.
- Its stock can be combined with André's product check the same way as above: `python -m sensei combine --stock out/lab.json --product out/andre.json --out out/final.json`.

## Backup: our own pipeline (`backend/`)

If the predictor fails on the day, the CLIP crate model in `backend/` needs nothing from `agents/`:

Everything runs from `backend/` on one laptop, with the data in `data/` and `eval/labels.json` up to date.

## Before (once)

```bash
python -m pip install -r requirements.txt
python -m sensei train-single
```

`train-single` builds the CLIP ViT-B-32 features (a few minutes the first time, cached after), fits
the single-image model on `eval/labels.json` plus André's product fixes and saves `outputs/single.pkl`.

## On the day

1. Put the validation photos in a folder laid out like the data: `<folder>/<camera>/<timestamp>.jpg`.
2. Run:

```bash
python -m sensei predict --images PATH/TO/validation --out ../outputs/predictions_validation.json
```

3. Check the output:
   - `using the single-image model (only the photo under analysis)`. If not, run `train-single` first.
   - `0 context images`: Sensei asked us to use only the image under analysis.
   - No `VALIDATION PROBLEMS` line (a missing area costs -5).
4. Submit `outputs/predictions_validation.json`.

## Not the submission: the "509" combination

On the 5 interleaved folds the best result that uses only the photo under analysis is André's
fine-tuned DINOv2-base for stock plus our CLIP model for the product check: 3399 / 3858, about
509 / 578. That number trains on the photos an hour before and after each test photo, so it is
optimistic for the hidden set. The combination has no forward-split row yet (André found that a
larger backbone does worse there), its stock model has no deployment code or weights in git, and it
costs about 8 times more per photo than the submission. Kept only in case its forward row, requested
on the board, beats R3 by more than noise.

1. André runs his fine-tuned DINOv2-base model on the validation folder and writes `andre.json`
   (same format as the submission).
2. Miguel runs `predict` as above and writes `miguel.json`.
3. Combine and submit:

```bash
python -m sensei combine --stock andre.json --product miguel.json --out ../outputs/predictions_validation.json
```

The command takes stock from the first file and the product check from the second, fills any
missing area and fails loudly if the result is incomplete. Cheaper option: the DINOv2-small stock
model instead (3349, about 502 / 578, about 1.7 s per photo on CPU instead of 6.4).

## Score and cost of the backup

The cost per analysed image for the pitch is the submission's, in `docs/COST.md`. These are the
backup pipeline's numbers:

| Check | Result |
|---|---|
| Team benchmark (`LEADERBOARD.md`), single image, ViT-B-32, LR + GBM blend | 3253 / 3858, about 487 / 578 |
| Forward split, CLIP crate model (`single_crate`), areas both label versions agree on | +447 / 538, about 480 / 578 (the submission: +494, about 531) |
| Always "right product, full" | about 233 / 578 |
| Cost | 0.8 s per photo on 2 CPU threads, no GPU (`python timing.py`) |

The person detector (`--persons`) adds 0.75 s per photo. None of our photos has a person in front
of the produce, so it is off by default.
