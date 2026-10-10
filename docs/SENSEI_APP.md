# Sensei · Fruit and vegetables shelf monitoring

App for the Sensei challenge (JunctionX Lisbon 2026). From the ceiling cameras, it tells you for **each planogram area** whether the right product is there and whether the area is **empty, half or full**, and it shows staff what to do first.

- It works **without labels**: zero-shot CLIP plus unsupervised learning per camera.
- It decides with the **challenge points matrix** (overestimating stock costs −3, underestimating costs −2). It picks the level with the most expected points, not the most likely one.
- It has a **staff dashboard** (in English) and an **annotation tool** that feeds a local scorer and an optional calibration.

## Quick start

The dataset is not in the repository (it belongs to the challenge). Unzip the official archive so you end up with `data/planogram.json` and `data/images/<camera>/<timestamp>.jpg`.

```bash
python -m pip install -r requirements.txt
```

```bash
python -m sensei predict
```

```bash
python -m sensei serve
```

Open http://127.0.0.1:8000, or double-click `run_app.bat`. Use `--host 0.0.0.0` so the team can annotate from other computers on the same network.

The first prediction takes about 8 minutes: it downloads the CLIP model (~600 MB) and extracts features from 181 images on CPU. After that the features are cached in `outputs/cache/` and a run takes seconds.

## Validation day (submission)

1. Put the validation images in a folder with the same structure: `<folder>/<camera>/<timestamp>.jpg`.
2. Run the command below. The training and test images go in as unlabelled *context*, which helps the model learn what each area looks like when empty or full over the day.

```bash
python -m sensei predict --images PATH/TO/validation --context data/images --out outputs/submission_validation.json
```

3. The command checks the format (every area of every image, `stock_value` consistent with `stock_level`, booleans) and fails with a warning if anything is missing. A missing area costs −5.
4. If the folder comes without per-camera subfolders, pass `--camera 6215` once per folder.

## Commands

| Command | What it does |
|---|---|
| `python -m sensei predict` | Predicts every area of every image. Writes `outputs/submission.json` (official format) and `outputs/details.json` (probabilities, for the app) |
| `python -m sensei serve` | Dashboard and annotation tool |
| `python -m sensei score --gt annotations/team.json` | Scores with the challenge rules |
| `python -m sensei calibrate` | Fits a small model to the team annotations (cross-validated, saved only if it improves) |
| `python -m sensei vlm-label` | Optional: labels images with Claude vision. Needs `ANTHROPIC_API_KEY` |
| `python -m sensei predict --no-clip` | Classic features only (no PyTorch) |

## The app

- **Tasks**: the start-of-shift view. 1) *Restock* (empty), 2) *Move back* (planogram not respected), 3) *Later* (half). Each card has the crop of the area, where it is, since when it has been like that and how many areas of the same product are empty. "Done" is stored locally.
- **Gondolas**: the image from each camera with the areas coloured by status. Clicking an area opens its detail, with how it changed through the day and why the model decided what it did.
- **Products**: stock summed per product across all areas, most critical first.
- **Clock** (top): shows the state of the store at any time of day.
- **Label**: keyboard controls. `1/2/3` for empty/half/full, `X` for wrong product, `Enter` to accept the prediction, `←/→` for area, `N/P` for image. It writes to `annotations/team.json` in the official format.
- **Score**: score on the annotated areas (same table as the brief), worst errors first, a button to calibrate and predict again, and submission export.

## How it works

```
image ──► rectified crop per area (homography; areas with negative coordinates handled with a mask)
      ──► features: HSV histogram, colour/texture, CLIP embedding (ViT-B-16, CPU)
      ──► STOCK: CLIP "empty/half/full of <product>"  +  visible fraction of the container
                 (learns the empty container colour per camera from the crops CLIP is
                  sure are empty, and the product colour from the fullest ones)
      ──► PRODUCT: CLIP text per family + image prototypes per family, built with the
                   planogram itself as a weak label; 93% compliance prior;
                   swaps between visually indistinguishable families (Gala vs Fuji) are never flagged
      ──► DECISION: argmax of expected points (+1/−2/−3 matrix)
```

Code: `sensei/` (pipeline) and `app/` (FastAPI server and a frontend with no build step).

| File | Contents |
|---|---|
| `sensei/catalog.py` | Portuguese name → family, English description, packaged or loose, short name |
| `sensei/geometry.py` | Quadrilateral rectification, clipping |
| `sensei/extract.py` | Image discovery, features, cache |
| `sensei/models.py` | Label-free model (stock and compliance) |
| `sensei/decision.py` | Decision with asymmetric costs |
| `sensei/scoring.py` | Scorer with the official rules |
| `sensei/calibrate.py` | Optional calibration with annotations |
| `sensei/vlm.py` | Optional Claude teacher |

## Known limitations (seen in the training images)

- Grey or transparent packaging (kiwis on 6376, grapes and cherries on 6462) sometimes looks "empty" to CLIP.
- White shelves with no crate (6462 in the morning) are not always recognised as empty.
- Packaged products with coloured labels produce some false "wrong product" flags (for example 6462_5/6 and 6468_5).
- The thresholds were chosen by eye. Calibrating with 300 or more annotated areas should fix much of this.
