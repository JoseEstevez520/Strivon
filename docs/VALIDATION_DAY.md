# Validation day

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

## Best score: combine two models

On the benchmark the best result that uses only the photo under analysis is André's fine-tuned
DINOv2-base for stock plus our CLIP model for the product check: 3399 / 3858, about 509 / 578.

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

Rehearse it tonight on a copy of a few training photos, so the file names and folders match.

## Score and cost

| Check | Result |
|---|---|
| Team benchmark (`LEADERBOARD.md`), single image, ViT-B-32, LR + GBM blend | 3253 / 3858, about 487 / 578 |
| Always "right product, full" | about 233 / 578 |
| Cost | 0.8 s per photo on 2 CPU threads, no GPU (`python timing.py`) |

Cost per analysed image for the pitch: 0.8 s on 2 vCPUs. A 2-vCPU cloud machine costs about
$0.09 per hour, so that is about $0.00002 per photo: about 2 cents per 1000 photos, or about
$0.40 a day for a store with 14 cameras sending a photo every minute. No GPU, no API calls.

The person detector (`--persons`) adds 0.75 s per photo. None of our photos has a person in front
of the produce, so it is off by default.
