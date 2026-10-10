# Leaderboard

Every approach is scored the same way, so the numbers compare. The score is the challenge's own points and nothing else.

## Results

Answer key `labels_v1`: 1929 areas in 179 photos, so the maximum is 3858 points.

| Approach | Owner | Labels trained on | Looks at other photos? | Identification | Stock | Total / max | Per area | Last photo, per area | Seconds per photo |
|---|---|---|---|---:|---:|---:|---:|---:|---|
| Agents' pipeline, 9-model stock average, uses same-day photos | André (agents) | labels_v1 | yes, same camera and day | +1881 | +1461 | +3342 / 3858 | +1.733 | +1.623 | being measured |
| Agents' pipeline, 9-model stock average, each photo on its own | André (agents) | labels_v1 | no | +1839 | +1461 | +3300 / 3858 | +1.711 | +1.623 | being measured |
| Agents' pipeline + 3rd stock head, uses same-day photos | André (agents) | labels_v1 | yes, same camera and day | +1881 | +1389 | +3270 / 3858 | +1.695 | +1.503 | 2.34 CPU (+ up to 0.6), 0.17 GPU |
| Agents' pipeline, uses same-day photos | André (agents) | labels_v1 | yes, same camera and day | +1881 | +1371 | +3252 / 3858 | +1.686 | +1.543 | 2.34 CPU, 0.17 GPU |
| Agents' pipeline + 3rd stock head, each photo on its own | André (agents) | labels_v1 | no | +1839 | +1385 | +3224 / 3858 | +1.671 | +1.483 | 3.44 CPU (+ up to 0.6), 0.21 GPU |
| Agents' pipeline, each photo on its own | André (agents) | labels_v1 | no | +1839 | +1351 | +3190 / 3858 | +1.654 | +1.457 | 3.44 CPU, 0.21 GPU |
| Agents' pipeline, uses same-day photos | André (agents) | André's 511 + AI pre-labels | yes, same camera and day | +1860 | +1011 | +2871 / 3858 | +1.488 | +1.146 | 2.34 CPU, 0.17 GPU |
| Agents' pipeline, each photo on its own | André (agents) | André's 511 + AI pre-labels | no | +1839 | +1019 | +2858 / 3858 | +1.482 | +1.126 | 3.44 CPU, 0.21 GPU |
| Always "right product, full" (baseline) | | none | no | +1653 | −99 | +1554 / 3858 | +0.806 | +0.344 | 0 |

Agents' pipeline:
- The product check is SigLIP2-base zero-shot plus nearest neighbours over the training folds' crops.
- Stock is the average of two stock models.
- "9-model stock average" replaces the stock part with 9 equal members:
  - 8 stock models, each on a different image model;
  - 1 model that compares each crate, cell by cell, with the same area's labelled photos from the training folds.

  It runs 8 image models per photo, so it costs more than the rows below. Its seconds per photo are being measured.
- "+ 3rd stock head" adds a plain logistic regression on the same DINOv2-small crate features as a third member of that average. It was the best of 5 heads tried on this benchmark, so part of its gain may come from that choice. It also scores lower on the last photo.
- The same-day version reuses the answer of the same area in a similar-looking photo of the same camera. That's why it also runs faster.
- Seconds are end to end, on the 14 newest photos, after a 12.5 s start-up. Machine: Ryzen 9 5900HS laptop CPU (4 threads) and RTX 3060 Laptop GPU.
- The code isn't in this repo yet.
- Prediction files: `eval/benchmark/preds/agents_*.json`.

## How to get a score

1. **Answer key.** `eval/benchmark/labels_v1.json` is the team's `eval/labels.json` at commit 6caa1bc, with three changes:
   - 13 clear product mistakes are fixed: lemons in the kiwi crates and onions in a potato crate.
   - 18 areas are left out until the team settles two rules: whether another variety counts as the wrong product, and whether bagged counts as different from loose.
   - The two night-curtain photos (06:12 on cameras 6383 and 6386) are left out.

   The first two lists are in `annotations/andre/product_label_fixes.md`.
2. **Folds.** `eval/benchmark/folds.json` puts every photo in one of 5 folds:
   - Sort each camera's photos by time and number them 0, 1, 2, and so on.
   - The fold is (number + camera index) mod 5. The camera index is the camera's place in the sorted list of cameras (6215 is 0, 6781 is 13).

   Every fold has 35 to 38 photos and includes every camera. Two photos an hour apart, which look almost the same, are never in the same fold.
3. **Never fit on the fold you predict.** For each fold, fit and tune everything using only the photos and labels of the other 4 folds. That covers model weights, thresholds, biases, calibration, PCA, prototypes and reference crops. Never tune on the out-of-fold predictions. Predict every area of the held-out fold. Then merge the 5 runs into one predictions file in the format of `eval/labels.json`.
4. **Score.** Run `python eval/benchmark.py score predictions.json`. It prints the points table and a row for this page. The points are the rules':

   | Case | Points |
   |---|---:|
   | Identification right | +1 |
   | Identification wrong | −2 |
   | Stock level right | +1 |
   | Stock level below the real one | −2 |
   | Stock level above the real one | −3 |
   | Missing area | −5 |

   "Last photo, per area" scores the same predictions on each camera's last photo of the day (14 photos, 151 areas). The rules' example photo is from 20:24, later than any photo we have of that camera, so late photos matter.
5. **Fill in the rest of the row:**
   - Labels trained on: the key, André's, AI pre-labels, or a mix.
   - Looks at other photos?: does predicting one photo use any other photo, for example a same-day reference?
   - Seconds per photo: and on which machine, since processing cost is part of the judging.

   Commit the predictions file as `eval/benchmark/preds/<approach>.json`, so anyone can re-score it.

To get the folds in code, put `eval/` on the path, then `from benchmark import train_test`. `train, test = train_test(0)` gives the (camera, image) lists of fold 0.

When the open rules are settled or the labels change, the key becomes `labels_v2`. Every row is then re-scored from its predictions file.
