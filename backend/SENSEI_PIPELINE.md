# CLIP pipeline, dashboard and labelling tool

Everything here runs from `backend/`. It reads `data/planogram.json` and `data/images/<camera>/<timestamp>.jpg` from the repo root and writes to `outputs/`.

## Setup

```bash
python -m pip install -r requirements.txt
```

The first prediction downloads the CLIP model (about 600 MB) and takes about 8 minutes on a CPU for the 181 train/test images. After that the features are cached in `outputs/cache/` and it takes seconds.

## Commands

| Command | What it does |
|---|---|
| `python -m sensei predict` | Predicts every area of every image. Writes `outputs/predictions.json` (submission format) and `outputs/details.json` (probabilities for the dashboard). Fails if any area is missing or malformed. |
| `python -m sensei serve` | Dashboard and labelling tool on http://127.0.0.1:8000. Add `--host 0.0.0.0` so the team can label from other laptops on the same network. |
| `python -m sensei score` | Scores `outputs/predictions.json` against `eval/labels.json` with the challenge rules. |
| `python -m sensei calibrate` | Fits a small model on `eval/labels.json` on top of the label-free features. It is saved only if it beats the label-free model in cross-validation. |
| `python -m sensei vlm-label` | Optional. Labels images with Claude vision. Needs `ANTHROPIC_API_KEY` in `.env` or the environment. |

## Validation day

```bash
python -m sensei predict --images PATH/TO/validation --context ../data/images --out ../outputs/predictions_validation.json
```

The train and test images go in as unlabelled context: they show the model what each area looks like empty and full during the day.

## How it works

1. Each planogram area is warped to a rectangle. Areas partly outside the image get a validity mask.
2. Features per area: HSV histogram, colour and texture, and a CLIP embedding (ViT-B-16 on CPU).
3. Stock: CLIP is asked "empty / half / full of <product>", and we measure how much bare container is visible. The colour of an empty container is learned per camera from the crops CLIP is surest are empty. No labels needed.
4. Product: CLIP text prompts per product family, plus image prototypes per family built from the planogram itself as weak labels. We assume about 93% of areas are right. Swaps between families that look the same from the ceiling (Gala vs Fuji) are never flagged.
5. Decision: the level with the most expected points under the scoring rules, so when unsure it leans low (over-estimating costs -3).

## Dashboard

- **Tasks**: Restock, Move back and Later, each card with the crop, where it is, the photo time and since when.
- **Gondolas**: each camera photo with the areas coloured by status. Tapping an area shows how it changed through the day and why the model decided that.
- **Products**: stock added up over all areas of each product.
- **Label**: fast keyboard labelling (`1/2/3` empty/half/full, `X` wrong product, `Enter` accept prediction, `N/P` next/previous photo). It saves to `eval/labels.json` in the annotation format, so `eval/score.py` works on it too.
- **Score**: our score on the labelled areas, worst errors first, and a button to calibrate and predict again.

## Known weak spots

- Grey or clear packages (kiwis on 6376, grapes and cherries on 6462) sometimes look empty to CLIP.
- White shelves with no crate (6462 early morning) are not always seen as empty.
- Packaged products with colourful labels give a few false "wrong product" alerts (6462_5/6, 6468_5).

## Shared labelling

- Run `python -m sensei serve --host 0.0.0.0` on one laptop; everyone opens `http://<that-ip>:8000` and goes to **Label**.
- Write your name first. Every label is saved to `eval/labels.json` and logged with your name in `eval/labels_activity.jsonl`; all open pages refresh within 3 seconds.
- Only photos 1-8 of each camera can be labelled. The last photos are locked and held out to test the model; calibration never uses them, and the Score tab shows train and test scores apart.
