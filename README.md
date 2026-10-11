<p align="center">
  <img src="assets/logo.svg" alt="Strivon" width="104">
</p>

<h1 align="center">Strivon</h1>

<p align="center">
  <strong>Strivon turns ceiling-camera photos of the fruit and vegetable shelves into a list of work for store staff: what to restock and what to put back.</strong>
</p>

<p align="center">
  For a store with ceiling cameras and a shelf planogram.
</p>

<p align="center">
  <a href="https://strivon-landing.vercel.app"><img src="https://img.shields.io/badge/Website-strivon--landing.vercel.app-c4452f?style=flat-square&logo=googlechrome&logoColor=white" alt="Strivon website"></a>
  <a href="docs/APP.md"><img src="https://img.shields.io/badge/Docs-Read-1d1d1d?style=flat-square&logo=readthedocs&logoColor=white" alt="Strivon documentation"></a>
</p>

<p align="center">
  <a href="#run-it-locally">Run locally</a> ·
  <a href="README.es.md">Español</a> ·
  <a href="README.pt.md">Português</a>
</p>

<p align="center">
  <img src="assets/readme/photo-to-tasks.png" alt="A ceiling-camera photo of a banana gondola with its shelf areas outlined, and next to it the list of tasks the staff get: three areas to restock and two to check later" width="100%">
</p>

<p align="center"><sub>One photo in, a list of work out. The shelf states in this image are simulated.</sub></p>

## What is Strivon?

In a store, nobody can look at every shelf all day. A shelf runs empty, a product ends up in the
place of another one, and the staff find out when a customer asks. The ceiling cameras already see
all of it. What is missing is someone to look at the photos.

Strivon does the looking. From a camera photo and the store's planogram, it checks each shelf area:
is it holding the product it should, and how full is it? What comes out is a list of work for the
staff, not a report.

It was built at JunctionX Lisbon 2026 for the Sensei challenge, with photos from 14 cameras.

## How it works

For every shelf area in a photo, the pipeline answers two questions, and the app turns the answers
into tasks.

| Question | Answer | Task for the staff |
|---|---|---|
| Is the right product there? | yes or no | **Move back** when it is the wrong one |
| How full is the area? | empty, half full or full | **Restock** when empty, **Later** when half full, nothing when full |

A task shows the crop of the area and the time of its photo, so the person can check it at a
glance. The challenge scores each area, so the pipeline is tuned for the points as well as for the
tasks: see [`docs/PLAN.md`](docs/PLAN.md).

## What you can do today

- **See what to do now**, grouped into Restock, Move back and Later, ordered by urgency.
- **Open a task** to see its camera photo with the shelf area marked, and **play the day** with the
  day bar to watch the list change.
- **Browse the store** with a map of the gondolas, a page per gondola, a products view and an
  insights page with the share of the time that shelves were empty.
- **Ask the store a question** and get the answer as a screen, with charts, tasks and photo
  cards. It needs a model key on the server.
- **Predict a folder of photos** from the command line: one JSON with `planogram_compliant` and
  `stock_level` for every area.
- **Score the predictions** against our own labels with the challenge's points.

> **Status.** The app still shows simulated shelf states. Connecting it to the pipeline's real
> predictions is the next step.

## See it

The landing is at [strivon-landing.vercel.app](https://strivon-landing.vercel.app).

<br>

### The app for staff

<img align="right" width="55%" src="assets/video/demo-tasks.gif" alt="The task list fills as the day plays: empty shelf areas, half full ones and products in the wrong place. Opening a task shows the photo of its camera with the shelf area marked.">

Each shelf area that needs something becomes a task: restock what is empty, move back what is in
the wrong place and check later what is half full.

Play the day to see the list fill, and open a task to see its shelf with the area marked.

<br clear="right">
<br>

### Ask, and get a screen

<img align="right" width="55%" src="assets/video/chat-to-gondola.gif" alt="Someone asks where the bananas are. The chat answers with a chart of how the shelves emptied through the day and a card. Opening the card shows the gondola's photo with its shelf areas marked.">

The chat does not answer with a paragraph. The model writes the layout of the answer out of the
app's own parts (charts, tables, tasks, a map of the day, photo cards) and the app draws it, so an
answer can be opened and followed to the shelf it talks about.

It needs a model key on the server (`LLM_API_KEY` in `frontend/.env`); without one the chat is
hidden.

<br clear="right">
<br>

The shelf states in both clips are simulated. Full-size clips are in [`assets/video`](assets/video).

## Run it locally

The app, with Node 20 or higher:

```bash
cd frontend
npm install
npm run dev
```

With the challenge data in `data/`, it shows the real photos and shelf areas. Without it, it draws
made-up shelves.

The pipeline, from `backend/`. Add `--no-clip` to skip PyTorch and use the classical features only:

```bash
python -m pip install -r requirements.txt
python -m sensei predict
python -m sensei score
```

By default `predict` reads `data/images` and writes `outputs/predictions.json`, and `score` checks
that file against `eval/labels.json`.

The steps for the day of the submission are in [`docs/VALIDATION_DAY.md`](docs/VALIDATION_DAY.md).

## Documentation

- [`docs/APP.md`](docs/APP.md): what the app shows and the data it reads.
- [`frontend/DESIGN.md`](frontend/DESIGN.md): how the interface looks and the reason for each choice.
- [`docs/PLAN.md`](docs/PLAN.md): how the challenge is scored and the plan to score well.
- [`docs/SENSEI_INFO.md`](docs/SENSEI_INFO.md): what Sensei told us, including what empty, half and full mean.
- [`docs/VALIDATION_DAY.md`](docs/VALIDATION_DAY.md): how to produce the submission.
- [`LEADERBOARD.md`](LEADERBOARD.md): how every approach is scored, and the results.
- [`CONTRIBUTING.md`](CONTRIBUTING.md): branches, commits and language.

## Results

Every approach scored the same way on the team benchmark. The rules are in
[LEADERBOARD.md](LEADERBOARD.md). Refresh the tables with `python eval/leaderboard.py`.

<details>
<summary>Leaderboard</summary>

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
| 8 | Single image, no CLIP: weighted average of three lab stock models (pixel features, slot references, a small fine-tuned MobileNetV3) + product check against a bank of training crops, colours balanced per crop (the shipped model, `python lab/predict.py`) (`lab_image_only_ensemble`) | Jose (lab) | the key | training crops only | +1893 | +1448 | +3341 / 3858 | +501 | +1.732 | +1.424 | 0.14 CPU per photo (1 thread, warm); 0.31 per photo over a batch of 28 including a 4.8 startup (torch import 3.8); i7 laptop, no GPU |
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

</details>

<details>
<summary>Forward split, closest to the hidden set</summary>

<!-- FORWARD:START -->
Forward split: trained without each camera's last 2 photos, tested on them (302 areas). Files in `eval/benchmark/preds_forward/`, scored with `python eval/benchmark.py forward <file>`.

| # | Approach | Identification | Stock | Below | Above | Total / max | Per area | ≈ / 578 | Seconds per photo |
|---:|---|---:|---:|---:|---:|---:|---:|---:|---|
| 1 | Combined: stock = the lower of Miguel's CLIP crate model and José's lab ensemble, product check from the CLIP crate model (`combo_min_crate_lab`) | +302 | +150 | 24 | 20 | +452 / 604 | +1.497 | +433 | about 1.1-1.5 CPU (0.9-1.4 + 0.14) |
| 2 | Agents' FINAL model R3: one-pass DINOv2-S retrained on newer labels + block-8 stock head, seed 0 (`agents_R3_s0`) | +299 | +151 | 17 | 25 | +450 / 604 | +1.490 | +431 | 0.74-0.82 CPU, 0.06 GPU |
| 3 | Agents' FINAL model R3: one-pass DINOv2-S retrained on newer labels + block-8 stock head, seed 1 (`agents_R3_s1`) | +299 | +142 | 16 | 28 | +441 / 604 | +1.460 | +422 | 0.74-0.82 CPU, 0.06 GPU |
| 4 | Agents' one-pass DINOv2-S, round-1 pick, seed 1 (`agents_R0_shipped_s1`) | +299 | +139 | 13 | 31 | +438 / 604 | +1.450 | +419 | 0.82 CPU, 0.06 GPU |
| 5 | Single image: CLIP ViT-B-32 on the hand-drawn crate + colour + area id, logistic regression (`single_crate`) | +302 | +135 | 21 | 26 | +437 / 604 | +1.447 | +418 | 0.9-1.4 s, 2-8 CPU threads (laptop), no GPU |
| 6 | Agents' one-pass DINOv2-S, round-1 pick, seed 0 (`agents_R0_shipped_s0`) | +299 | +136 | 26 | 22 | +435 / 604 | +1.440 | +416 | 0.82 CPU, 0.06 GPU |
| 7 | Single image, no CLIP: weighted average of three lab stock models (pixel features, slot references, a small fine-tuned MobileNetV3) + product check against a bank of training crops, colours balanced per crop (the shipped model, `python lab/predict.py`) (`lab_image_only_ensemble`) | +299 | +124 | 14 | 34 | +423 / 604 | +1.401 | +405 | 0.14 CPU per photo (1 thread, warm); 0.31 per photo over a batch of 28 including a 4.8 startup (torch import 3.8); i7 laptop, no GPU |
<!-- FORWARD:END -->

</details>

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
