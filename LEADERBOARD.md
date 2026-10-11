# Leaderboard

Every approach is scored the same way, so the numbers compare. The score is the challenge's own points and nothing else.

## Results

Regenerate with `python eval/leaderboard.py` (it re-scores every file in `eval/benchmark/preds/`).

Sensei: "You should only consider information from the image under analysis" (see `docs/SENSEI_INFO.md`). Rows marked "yes" under "Looks at other photos?" use other photos of the day, so they are for comparison only.

<!-- LEADERBOARD:START -->
Answer key `labels_v1`: 1929 areas, maximum 3858 points. "≈ /578" scales the total to the 289 hidden validation areas.

| # | Approach | Owner | Labels trained on | Looks at other photos? | Identification | Stock | Total / max | ≈ / 578 | Per area | Last photo, per area | Seconds per photo |
|---:|---|---|---|---|---:|---:|---:|---:|---:|---:|---|
| 1 | Combined: stock from André's fine-tuned DINOv2-base, product check from Miguel's CLIP crate model (`combo_dinob_stock_clip_product`) | André + Miguel | the key | no | +1911 | +1488 | +3399 / 3858 | +509 | +1.762 | +1.675 | about 6.4 CPU (stock 5.6 + product 0.8); stock 0.23 GPU |
| 2 | Agents, image only: product head on frozen DINOv2-small + fine-tuned DINOv2-base stock (2 seeds) (`agents_img_ftB2`) | André (agents) | labels_v1 | no | +1905 | +1488 | +3393 / 3858 | +508 | +1.759 | +1.636 | 6.67 CPU; ≈ 0.26 GPU (from component timings) |
| 3 | Agents' pipeline, fine-tuned DINOv2-base stock (2 seeds), uses same-day photos (`agents_finetuned_b_same_day`) | André (agents) | labels_v1 | yes, same camera and day | +1881 | +1488 | +3369 / 3858 | +505 | +1.747 | +1.675 | ≈ 7 CPU (stock 5.6 + product 1.1–1.6), ≈ 0.4 GPU |
| 4 | Combined, cheap: stock from André's fine-tuned DINOv2-small, product check from Miguel's CLIP crate model (`combo_dinos_stock_clip_product`) | André + Miguel | the key | no | +1911 | +1438 | +3349 / 3858 | +502 | +1.736 | +1.563 | about 1.7 CPU (stock 0.9 + product 0.8) |
| 5 | Agents, image only, ONE DINOv2-small pass: product from frozen block 8, stock from the fine-tuned blocks (`agents_img_one_pass`) | André (agents) | labels_v1 | no | +1911 | +1438 | +3349 / 3858 | +502 | +1.736 | +1.543 | 0.82 CPU (4 threads); GPU being measured |
| 6 | Agents, image only: product head on frozen DINOv2-small + fine-tuned DINOv2-small stock (two passes) (`agents_img_ftS`) | André (agents) | labels_v1 | no | +1905 | +1438 | +3343 / 3858 | +501 | +1.733 | +1.523 | 1.75 CPU; ≈ 0.15 GPU (from component timings) |
| 7 | Agents' pipeline, 9-model stock average, uses same-day photos (`agents_9models_same_day`) | André (agents) | labels_v1 | yes, same camera and day | +1881 | +1461 | +3342 / 3858 | +501 | +1.733 | +1.623 | stock ≈ 2.4 GPU (2.6 GB VRAM) or up to ≈ 195 CPU, plus the product check |
| 8 | Single image, no CLIP: weighted average of three lab stock models (pixel features, slot references, a small fine-tuned MobileNetV3) + product check against a bank of training crops, colours balanced per crop (the shipped model, `python lab/predict.py`) (`lab_image_only_ensemble`) | Jose (lab) | the key | training crops only | +1893 | +1448 | +3341 / 3858 | +501 | +1.732 | +1.424 | 0.11 CPU per photo (1 thread, warm); 0.12 per photo over a batch of 28 including a 0.3 startup (`python lab/predict_fast.py`); i7 laptop, no GPU |
| 9 | Combined, cheaper: stock from André's fine-tuned DINOv2-small, product check from the lab's image-only model (HSV bank of training crops) (`combo_dinos_stock_lab_product`) | André + Jose (lab) | the key | training crops only | +1902 | +1438 | +3340 / 3858 | +500 | +1.731 | +1.523 | about 0.9 CPU (stock 0.9 + product 0.01, product measured on a loaded machine) |
| 10 | Agents' pipeline, fine-tuned DINOv2-base stock (2 seeds), each photo on its own (`agents_finetuned_b_single_photo`) | André (agents) | labels_v1 | no | +1839 | +1488 | +3327 / 3858 | +498 | +1.725 | +1.675 | ≈ 8.7 CPU (stock 5.6 + product 3.05); stock 0.23 GPU |
| 11 | Combined: stock = the lower of Miguel's CLIP crate model and José's lab ensemble, product check from the CLIP crate model (`combo_min_crate_lab`) | Miguel + José | the key | no | +1911 | +1413 | +3324 / 3858 | +498 | +1.723 | +1.470 | about 1.1-1.5 CPU (0.9-1.4 + 0.14) |
| 12 | Agents' pipeline, fine-tuned DINOv2-small stock, uses same-day photos (`agents_finetuned_s_same_day`) | André (agents) | labels_v1 | yes, same camera and day | +1881 | +1438 | +3319 / 3858 | +497 | +1.721 | +1.563 | ≈ 2–2.5 CPU (stock 0.9 + product 1.1–1.6), ≈ 0.3 GPU |
| 13 | Single image: pixel features of the area and its crate + logistic and tree blend, product check against a bank of training crops (`lab_image_only`) | Jose (lab) | the key | training crops only | +1902 | +1404 | +3306 / 3858 | +495 | +1.714 | +1.377 | being measured; features about 0.1 s per photo on 1 CPU thread (partial), no GPU, no CLIP |
| 14 | Agents' pipeline, 9-model stock average, each photo on its own (`agents_9models_single_photo`) | André (agents) | labels_v1 | no | +1839 | +1461 | +3300 / 3858 | +494 | +1.711 | +1.623 | stock ≈ 2.4 GPU (2.6 GB VRAM) or up to ≈ 195 CPU, plus the product check |
| 15 | Agents, image only: frozen DINOv2-small with a product head and a stock head (`agents_img_frozen_S`) | André (agents) | labels_v1 | no | +1905 | +1380 | +3285 / 3858 | +492 | +1.703 | +1.543 | 0.83 CPU; ≈ 0.12 GPU (from component timings) |
| 16 | Agents' pipeline, fine-tuned DINOv2-small stock, each photo on its own (`agents_finetuned_s_single_photo`) | André (agents) | labels_v1 | no | +1839 | +1438 | +3277 / 3858 | +491 | +1.699 | +1.563 | ≈ 4 CPU (stock 0.9 + product 3.05); stock 0.12 GPU |
| 17 | Agents' pipeline + 3rd stock head, uses same-day photos (`agents_same_day_3heads`) | André (agents) | labels_v1 | yes, same camera and day | +1881 | +1389 | +3270 / 3858 | +490 | +1.695 | +1.503 | 2.34 CPU (+ up to 0.6), 0.17 GPU |
| 18 | Single image: CLIP ViT-B-32 on the hand-drawn crate + colour + area id, logistic regression (`single_crate`) | Miguel (crates by Jose) | the key | no | +1911 | +1344 | +3255 / 3858 | +488 | +1.687 | +1.457 | 0.9-1.4 s, 2-8 CPU threads (laptop), no GPU |
| 19 | Single image: CLIP ViT-B-32 + colour + area id, logistic regression + gradient boosting blend (`single_blend_vitb32`) | Miguel | the key | no | +1905 | +1348 | +3253 / 3858 | +487 | +1.686 | +1.589 | 0.8-1.3 s, 2 CPU threads (laptop), no GPU |
| 20 | Agents' pipeline, uses same-day photos (`agents_same_day`) | André (agents) | labels_v1 | yes, same camera and day | +1881 | +1371 | +3252 / 3858 | +487 | +1.686 | +1.543 | 2.34 CPU, 0.17 GPU |
| 21 | Agents' pipeline + 3rd stock head, each photo on its own (`agents_single_photo_3heads`) | André (agents) | labels_v1 | no | +1839 | +1385 | +3224 / 3858 | +483 | +1.671 | +1.483 | 3.44 CPU (+ up to 0.6), 0.21 GPU |
| 22 | Single image + labelled training crops of the same area as references (`single_ref_vitb16`) | Miguel | the key | training crops only | +1905 | +1313 | +3218 / 3858 | +482 | +1.668 | +1.510 | about 3 s, 20 CPU threads (laptop) |
| 23 | Single image: CLIP ViT-B-16 + colour + area id, logistic regression (`single_vitb16`) | Miguel | the key | no | +1896 | +1315 | +3211 / 3858 | +481 | +1.665 | +1.503 | about 3 s, 20 CPU threads (laptop) |
| 24 | Single image: CLIP ViT-B-32 + colour + area id, logistic regression (`single_vitb32`) | Miguel | the key | no | +1908 | +1297 | +3205 / 3858 | +480 | +1.661 | +1.543 | 0.8 s, 2 CPU threads (laptop), no GPU |
| 25 | Agents' pipeline, each photo on its own (`agents_single_photo`) | André (agents) | labels_v1 | no | +1839 | +1351 | +3190 / 3858 | +478 | +1.654 | +1.457 | 3.44 CPU, 0.21 GPU |
| 26 | Agents' pipeline, uses same-day photos (`agents_same_day_andre_labels`) | André (agents) | André's 511 + AI pre-labels | yes, same camera and day | +1860 | +1011 | +2871 / 3858 | +430 | +1.488 | +1.146 | 2.34 CPU, 0.17 GPU |
| 27 | Agents' pipeline, each photo on its own (`agents_single_photo_andre_labels`) | André (agents) | André's 511 + AI pre-labels | no | +1839 | +1019 | +2858 / 3858 | +428 | +1.482 | +1.126 | 3.44 CPU, 0.21 GPU |
| 28 | Always "right product, full" (`baseline`) |  | none | no | +1653 | -99 | +1554 / 3858 | +233 | +0.806 | +0.344 | 0 |
<!-- LEADERBOARD:END -->

## Forward split (the one to choose with)

<!-- FORWARD:START -->
Forward split: trained without each camera's last 2 photos, tested on them (302 areas). Since `labels_v1` was frozen, 33 of these areas changed in `eval/labels.json`, most of them in André's review of the evening photos where his model disagreed with the labels (PR #61, #75). So `labels_v1` is stale there and the current labels lean towards his models. The table is sorted by the 269 areas where both keys agree, which no review touched. Files in `eval/benchmark/preds_forward/`, scored with `python eval/benchmark.py forward <file>` (all three keys).

| # | Approach | Unchanged areas: total / max | Per area | ≈ / 578 | Identification | Stock | Below | Above | `labels_v1`: total / 604 | Current labels: total / 604 | Seconds per photo |
|---:|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---|
| 1 | Agents' FINAL model R3, the submission's recipe (`agents/predict.py`): one-pass DINOv2-S retrained on newer labels + block-8 stock head, seed 0 (`agents_R3_s0`) | +494 / 538 | +1.836 | +531 | +269 | +225 | 4 | 8 | +450 | +539 | 2.0 CPU s per photo end to end at 1 thread (28 photos, 6.6 s start-up included; Miguel's laptop, Core Ultra 7 155H); 0.74-0.82 wall at 4 threads (André's laptop); 0.06 GPU |
| 2 | Agents' FINAL model R3, the submission's recipe (`agents/predict.py`): one-pass DINOv2-S retrained on newer labels + block-8 stock head, seed 1 (`agents_R3_s1`) | +483 / 538 | +1.796 | +519 | +269 | +214 | 5 | 10 | +441 | +524 | 2.0 CPU s per photo end to end at 1 thread (28 photos, 6.6 s start-up included; Miguel's laptop, Core Ultra 7 155H); 0.74-0.82 wall at 4 threads (André's laptop); 0.06 GPU |
| 3 | Rule fixed in advance, not adopted: stock = best expected points on the average of the CLIP crate, lab and R3 (seed 0) probabilities, product check from R3 (`combo_avg_crate_lab_R3`) | +481 / 538 | +1.788 | +517 | +269 | +212 | 3 | 12 | +452 | +507 | about 1.8-2.3 wall (R3 0.8 + crate 0.9-1.4 + lab 0.12), from component timings |
| 4 | Agents' SUBMISSION DEFAULT since 11 Oct 09:40 (`agents/predict.py`, = `--stock-model mix`): R3 retrained with stock targets 0.75 team labels + 0.25 the two AI readings of Sensei's rule (`lab/silver2`), product head on the team labels, seed 1. A hedge, not a gain on our labels: about the same as R3 here, +27 stock under José's human reader (est.) and +29 where the AI readings agree (`agents_R3mix_s1`) | +478 / 538 | +1.777 | +514 | +269 | +209 | 8 | 9 | +448 | +513 | same as R3: about 0.8 CPU s per photo (4 threads), start-up about 2-3 s since #152 |
| 5 | Rule fixed in advance, not adopted: stock = the lower of the CLIP crate model and R3 (seed 0), product check from R3 (`combo_min_crate_R3`) | +476 / 538 | +1.770 | +511 | +269 | +207 | 14 | 5 | +456 | +507 | about 1.7-2.2 wall (R3 0.8 + crate 0.9-1.4), from component timings |
| 6 | Agents' SUBMISSION DEFAULT since 11 Oct 09:40 (`agents/predict.py`, = `--stock-model mix`): R3 retrained with stock targets 0.75 team labels + 0.25 the two AI readings of Sensei's rule (`lab/silver2`), product head on the team labels, seed 0. A hedge, not a gain on our labels: about the same as R3 here, +27 stock under José's human reader (est.) and +29 where the AI readings agree (`agents_R3mix_s0`) | +471 / 538 | +1.751 | +506 | +269 | +202 | 9 | 10 | +442 | +507 | same as R3: about 0.8 CPU s per photo (4 threads), start-up about 2-3 s since #152 |
| 7 | Rule fixed in advance, not adopted: stock = the lower of the CLIP crate model and the best expected points on the average of lab and R3 (seed 0), product check from R3 (`combo_min_crate_avg_lab_R3`) | +469 / 538 | +1.743 | +504 | +269 | +200 | 15 | 6 | +458 | +488 | about 1.8-2.3 wall (R3 0.8 + crate 0.9-1.4 + lab 0.12), from component timings |
| 8 | Agents' one-pass DINOv2-S, round-1 pick, seed 0 (`agents_R0_shipped_s0`) | +464 / 538 | +1.725 | +498 | +269 | +195 | 14 | 8 | +435 | +500 | 0.82 CPU, 0.06 GPU |
| 9 | Agents' one-pass DINOv2-S, round-1 pick, seed 1 (`agents_R0_shipped_s1`) | +464 / 538 | +1.725 | +498 | +269 | +195 | 6 | 14 | +438 | +489 | 0.82 CPU, 0.06 GPU |
| 10 | Combined: stock = the lower of Miguel's CLIP crate model and José's lab ensemble, product check from the CLIP crate model (`combo_min_crate_lab`) | +458 / 538 | +1.703 | +492 | +269 | +189 | 16 | 8 | +452 | +472 | about 1.1-1.5 CPU (0.9-1.4 + 0.14) |
| 11 | Single image, no CLIP: weighted average of three lab stock models (pixel features, slot references, a small fine-tuned MobileNetV3) + product check against a bank of training crops, colours balanced per crop (the shipped model, `python lab/predict.py`) (`lab_image_only_ensemble`) | +453 / 538 | +1.684 | +487 | +266 | +187 | 6 | 16 | +423 | +481 | 0.11 CPU per photo (1 thread, warm); 0.12 per photo over a batch of 28 including a 0.3 startup (`python lab/predict_fast.py`); i7 laptop, no GPU |
| 12 | Single image: CLIP ViT-B-32 on the hand-drawn crate + colour + area id, logistic regression (`single_crate`) | +447 / 538 | +1.662 | +480 | +269 | +178 | 13 | 13 | +437 | +457 | 0.9-1.4 s, 2-8 CPU threads (laptop), no GPU |
| 13 | Agents' LABEL-FREE line, zero labels (`agents/predict.py --label-free`, U7): SigLIP2 zero-shot product check + stock from the share of 3×3 crate regions that look like empty floor (ONE 336 px pass per crate, regions MAP-pooled), against a per-area baseline built from unlabelled photos (here: the forward split's training photos only) (`agents_labelfree_U7`) | +275 / 538 | +1.022 | +295 | +260 | +15 | 10 | 56 | +240 | +262 | 7.3-9.5 CPU s per photo (4 threads), 0.18-0.38 GPU (RTX 3060 laptop) |
| 14 | Agents' LABEL-FREE line, zero labels, earlier version U6 (replaced by U7): SigLIP2 zero-shot product check + stock from the share of 3×3 crate tiles that look like empty floor (9 tile passes), against a per-area baseline built from unlabelled photos (here: the forward split's training photos only) (`agents_labelfree_U6`) | +225 / 538 | +0.836 | +242 | +260 | -35 | 16 | 64 | +184 | +224 | ~22 CPU s per photo (4 threads), 0.4-1.3 GPU (RTX 3060 laptop) |
<!-- FORWARD:END -->

Agents' pipeline:
- "Image only" rows use nothing but the photo under analysis. The product check is a logistic regression on the frozen DINOv2-small view of the whole crate, with no comparison with other photos.
  - The one-pass row reads the product answer from block 8, the last frozen block, and the stock answer from the fine-tuned blocks of the same pass.
  - A product head trained jointly with stock scored lower: +3321.
  - Nothing was tuned on the benchmark: the block is simply the last frozen one, and the head settings are the earlier ones.
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
