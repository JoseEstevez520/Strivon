<p align="center">
  <img src="docs/banner.png" alt="Strivon: every shelf tells you what it needs before it runs empty" width="100%">
</p>

Strivon checks each shelf area from a ceiling camera and the store planogram: is it holding the
right product, and how full is it? Store staff get what to restock and what to move back.

## Layout

- `backend/` the pipeline that writes the predictions, and the server.
- `frontend/` the web for store staff.
- `eval/` and `annotations/` scoring and our own labels.
- `docs/` plan, tasks and notes.
- `data/` and `outputs/` challenge images and predictions. Not committed.

## Leaderboard

Every approach scored the same way on the team benchmark. Rules: [LEADERBOARD.md](LEADERBOARD.md).
Refresh with `python eval/leaderboard.py`.

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

## Prior code

Written during the hackathon, except:

- `frontend/src/model/catalog.ts` ports the product family rules of `backend/sensei/catalog.py`.
- The interface uses React, Vite, Tailwind CSS, shadcn/ui, Base UI, OpenUI, Lucide and
  country-flag-icons, all MIT. Versions are in `frontend/package.json`.

Built at JunctionX Lisbon 2026, for the Sensei challenge.

<p align="center">
  <img src="assets/partners/junctionx.png" alt="JunctionX Lisbon" height="56">
  &nbsp;&nbsp;&nbsp;
  <img src="assets/partners/sensei.png" alt="Sensei" height="56">
</p>

The JunctionX Lisbon and Sensei logos belong to their owners.
