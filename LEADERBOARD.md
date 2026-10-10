# Leaderboard

Every approach is scored the same way, so the numbers compare. The score is the challenge's own points and nothing else.

## Results

Regenerate with `python eval/leaderboard.py` (it re-scores every file in `eval/benchmark/preds/`).

<!-- LEADERBOARD:START -->
Answer key `labels_v1`: 1929 areas, maximum 3858 points. "≈ /578" scales the total to the 289 hidden validation areas.

| # | Approach | Owner | Labels trained on | Looks at other photos? | Identification | Stock | Total / max | ≈ / 578 | Per area | Last photo, per area | Seconds per photo |
|---:|---|---|---|---|---:|---:|---:|---:|---:|---:|---|
| 1 | Combined: stock from André's fine-tuned DINOv2-base, product check from Miguel's CLIP model (`combo_dinob_stock_clip_product`) | André + Miguel | the key | no | +1908 | +1488 | +3396 / 3858 | +509 | +1.760 | +1.675 | about 6.4 CPU (stock 5.6 + product 0.8); stock 0.23 GPU |
| 2 | Agents' pipeline, fine-tuned DINOv2-base stock (2 seeds), uses same-day photos (`agents_finetuned_b_same_day`) | André (agents) | labels_v1 | yes, same camera and day | +1881 | +1488 | +3369 / 3858 | +505 | +1.747 | +1.675 | ≈ 7 CPU (stock 5.6 + product 1.1–1.6), ≈ 0.4 GPU |
| 3 | Combined, cheap: stock from André's fine-tuned DINOv2-small, product check from Miguel's CLIP model (`combo_dinos_stock_clip_product`) | André + Miguel | the key | no | +1908 | +1438 | +3346 / 3858 | +501 | +1.735 | +1.563 | about 1.7 CPU (stock 0.9 + product 0.8) |
| 4 | Agents' pipeline, 9-model stock average, uses same-day photos (`agents_9models_same_day`) | André (agents) | labels_v1 | yes, same camera and day | +1881 | +1461 | +3342 / 3858 | +501 | +1.733 | +1.623 | stock ≈ 2.4 GPU (2.6 GB VRAM) or up to ≈ 195 CPU, plus the product check |
| 5 | Combined, cheaper: stock from André's fine-tuned DINOv2-small, product check from the lab's image-only model (HSV bank of training crops) (`combo_dinos_stock_lab_product`) | André + Jose (lab) | the key | training crops only | +1902 | +1438 | +3340 / 3858 | +500 | +1.731 | +1.523 | about 0.9 CPU (stock 0.9 + product 0.01, product measured on a loaded machine) |
| 6 | Agents' pipeline, fine-tuned DINOv2-base stock (2 seeds), each photo on its own (`agents_finetuned_b_single_photo`) | André (agents) | labels_v1 | no | +1839 | +1488 | +3327 / 3858 | +498 | +1.725 | +1.675 | ≈ 8.7 CPU (stock 5.6 + product 3.05); stock 0.23 GPU |
| 7 | Agents' pipeline, fine-tuned DINOv2-small stock, uses same-day photos (`agents_finetuned_s_same_day`) | André (agents) | labels_v1 | yes, same camera and day | +1881 | +1438 | +3319 / 3858 | +497 | +1.721 | +1.563 | ≈ 2–2.5 CPU (stock 0.9 + product 1.1–1.6), ≈ 0.3 GPU |
| 8 | Single image: pixel features of the area and its crate + logistic and tree blend, product check against a bank of training crops (`lab_image_only`) | Jose (lab) | the key | training crops only | +1902 | +1404 | +3306 / 3858 | +495 | +1.714 | +1.377 | being measured; features about 0.1 s per photo on 1 CPU thread (partial), no GPU, no CLIP |
| 9 | Agents' pipeline, 9-model stock average, each photo on its own (`agents_9models_single_photo`) | André (agents) | labels_v1 | no | +1839 | +1461 | +3300 / 3858 | +494 | +1.711 | +1.623 | stock ≈ 2.4 GPU (2.6 GB VRAM) or up to ≈ 195 CPU, plus the product check |
| 10 | Agents' pipeline, fine-tuned DINOv2-small stock, each photo on its own (`agents_finetuned_s_single_photo`) | André (agents) | labels_v1 | no | +1839 | +1438 | +3277 / 3858 | +491 | +1.699 | +1.563 | ≈ 4 CPU (stock 0.9 + product 3.05); stock 0.12 GPU |
| 11 | Agents' pipeline + 3rd stock head, uses same-day photos (`agents_same_day_3heads`) | André (agents) | labels_v1 | yes, same camera and day | +1881 | +1389 | +3270 / 3858 | +490 | +1.695 | +1.503 | 2.34 CPU (+ up to 0.6), 0.17 GPU |
| 12 | Single image: CLIP ViT-B-32 + colour + area id, logistic regression + gradient boosting blend (`single_blend_vitb32`) | Miguel | the key | no | +1905 | +1348 | +3253 / 3858 | +487 | +1.686 | +1.589 | 0.8-1.3 s, 2 CPU threads (laptop), no GPU |
| 13 | Agents' pipeline, uses same-day photos (`agents_same_day`) | André (agents) | labels_v1 | yes, same camera and day | +1881 | +1371 | +3252 / 3858 | +487 | +1.686 | +1.543 | 2.34 CPU, 0.17 GPU |
| 14 | Agents' pipeline + 3rd stock head, each photo on its own (`agents_single_photo_3heads`) | André (agents) | labels_v1 | no | +1839 | +1385 | +3224 / 3858 | +483 | +1.671 | +1.483 | 3.44 CPU (+ up to 0.6), 0.21 GPU |
| 15 | Single image + labelled training crops of the same area as references (`single_ref_vitb16`) | Miguel | the key | training crops only | +1905 | +1313 | +3218 / 3858 | +482 | +1.668 | +1.510 | about 3 s, 20 CPU threads (laptop) |
| 16 | Single image: CLIP ViT-B-16 + colour + area id, logistic regression (`single_vitb16`) | Miguel | the key | no | +1896 | +1315 | +3211 / 3858 | +481 | +1.665 | +1.503 | about 3 s, 20 CPU threads (laptop) |
| 17 | Single image: CLIP ViT-B-32 + colour + area id, logistic regression (`single_vitb32`) | Miguel | the key | no | +1908 | +1297 | +3205 / 3858 | +480 | +1.661 | +1.543 | 0.8 s, 2 CPU threads (laptop), no GPU |
| 18 | Agents' pipeline, each photo on its own (`agents_single_photo`) | André (agents) | labels_v1 | no | +1839 | +1351 | +3190 / 3858 | +478 | +1.654 | +1.457 | 3.44 CPU, 0.21 GPU |
| 19 | Agents' pipeline, uses same-day photos (`agents_same_day_andre_labels`) | André (agents) | André's 511 + AI pre-labels | yes, same camera and day | +1860 | +1011 | +2871 / 3858 | +430 | +1.488 | +1.146 | 2.34 CPU, 0.17 GPU |
| 20 | Agents' pipeline, each photo on its own (`agents_single_photo_andre_labels`) | André (agents) | André's 511 + AI pre-labels | no | +1839 | +1019 | +2858 / 3858 | +428 | +1.482 | +1.126 | 3.44 CPU, 0.21 GPU |
| 21 | Always "right product, full" (`baseline`) |  | none | no | +1653 | -99 | +1554 / 3858 | +233 | +0.806 | +0.344 | 0 |
<!-- LEADERBOARD:END -->

Agents' pipeline:
- The product check is SigLIP2-base zero-shot plus nearest neighbours over the training folds' crops.
- Stock is the average of two stock models.
- "Fine-tuned DINOv2" rows replace the stock part with one DINOv2 model retrained on the training folds' labels.
  - The settings were fixed before any result: last 4 blocks, 6 epochs, learning rate 2e-5, label smoothing 0.05, flip/brightness/shift.
  - The base rows average 2 training runs (seeds 0 and 1). That choice was made after seeing both runs.
  - Single runs: +3347 and +3350.
- "9-model stock average" replaces the stock part with 9 equal members:
  - 8 stock models: DINOv2-S/B/L at 224 and 448 px, SigLIP2-so400m, CLIP-L;
  - 1 model that compares each crate, cell by cell, with the same area's labelled photos from the training folds.

  It needs a GPU: about 195 s per photo on the laptop CPU.
- "+ 3rd stock head" adds a plain logistic regression on the same DINOv2-small crate features as a third member of the two-model average. It was the best of 5 heads tried on this benchmark, so part of its gain may come from that choice.
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
