# Hint model: estimate the fill, then let a per-product rule decide (11 Oct)

Sensei's hint: whether a crate is empty, half or full depends on the product and on who looks. So this model splits two things:
- **what the camera sees:** a continuous fill estimate from 0 to 1, called `fill_raw`;
- **how the store reads it:** a per-product rule that turns the fill into empty, half or full.

## The model
1. **Estimation.**
   - Two ordinal logistic heads, P(at least half) and P(full), on frozen DINOv2-small features: the patch mean of block 4, and the CLS token plus patch mean of block 8.
   - Blocks 1-8 are byte-identical to the pretrained DINOv2 in every deployed model. This was checked between `ld6ee` and `ld6ee_mix`: only blocks 9-12 differ. So no label from any photo is baked into these features.
   - `fill = 0.5 P(>=half) + 0.5 P(full)`.
2. **Decision.**
   - Without a store rule, the level is the best expected challenge points from the three ordinal probabilities.
   - With `--calibration {"family": [t1, t2]}`, the store's thresholds are used instead: empty below t1, half below t2, full above.
   - `fill_raw` is in the output, so the app's Calibration page (#192) reads it directly.
3. **Cost.** Only 8 transformer blocks run instead of 12, with no fine-tuned blocks. On 28 photos at 1 thread this took 34 s, against 86 s for the submission run the same way (not at the same moment).
4. **Units for big fruit.** The labels only say empty, half or full, so the model cannot count melons. `fill_raw` is a fill estimate, not a count. Counting would need count annotations.

## Forward split
Every row is trained without the forward photos and tested on them. All rows use the same product answers (from `agents_R3mix_s1`), so only stock differs. Scores are on the 269 unchanged areas (max 538) and the current labels (max 604).

| Option | Unchanged / 538 | Stock part | Current / 604 |
|---|---:|---:|---:|
| R3 `ld6ee` s0 (not the submission) | 494 | 225 | 539 |
| **Submission: R3 mix**, s0 / s1 | 471 / 478 | 202 / 209 | 507 / 513 |
| **Hint model**, best expected points | **474** | 205 | 507 |
| Hint model, global thresholds (0.18 / 0.86) fitted out-of-fold | 457 | 188 | 495 |
| Hint model, per-product thresholds fitted out-of-fold on our labels | 442 | 173 | 471 |
| André `--stock-mode sensei` (= the default) | 471 / 478 | | 507 / 513 |
| André `empty-at-a-few` | 463 / 463 | | 508 / 503 |
| André `empty-only-when-bare` | 454 / 449 | | 488 / 486 |
| André `strict-full` | 441 / 443 | | 468 / 466 |
| José's app, fill thresholds 0.2 / 0.7 on R3mix | 456 / 446 | | 489 / 475 |
| José's Strict profile (full at 80%) | 463 / 462 | | 495 / 500 |
| José's Relaxed profile (full at 40%) | 318 / 314 | | 319 / 315 |

**What this says:**
- The hint model scores like the submission (474 against 471 / 478), using 8 frozen blocks instead of 12 partly fine-tuned ones. That is a cost win at the same points.
- Per-product thresholds fitted on our own labels lose points (442), because each product has few examples and they overfit. Per-product rules are a store's choice to set in the app, not something to fit on our labels.
- Every store mode or profile moves the score away from our labels' line. That is expected: they model other stores' opinions.
- R3 `ld6ee` remains the best on our labels. Nothing here reaches 550 / 578 on our key: 494 / 538 is about 531 / 578.

## Run
```bash
python lab/hint_fill/extract_features.py OUT_DIR          # frozen features of data/images (about 2 min, 8 threads)
python lab/hint_fill/fit_deploy.py OUT_DIR                # -> lab/hint_fill/hint_heads.npz (in git, 20 KB)
python -I lab/hint_fill/predict_fill.py --images DIR --planogram data/planogram.json --out FILE [--calibration rules.json]
```
`train_eval.py` reproduces the forward table. Its arguments are a folder holding `lf/F.npy` and `lf/keys.json` (from `extract_features.py`) and a clone of this repo.
