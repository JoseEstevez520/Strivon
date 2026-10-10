<h1 align="center">Strivon</h1>

<p align="center">
  <strong>Strivon looks at a shelf of fruit and vegetables and tells store staff which areas hold the wrong product and which ones need restocking.</strong>
</p>

## What is Strivon?

Given an image from a ceiling camera and the store planogram, Strivon checks each shelf area: is
it holding the product it should, and how full is it?

## Layout

- `backend/` Python: the pipeline that writes the predictions, and the dashboard and labelling server.
- `frontend/` React and shadcn/ui: the view for store staff.
- `eval/` the scoring script and our own test labels.
- `annotations/` labels made by the team.
- `docs/` plan, tasks, app notes and what Sensei told us.
- `assets/` logos and README images.
- `data/` and `outputs/` challenge images and generated predictions. Not committed.

## Prior code

The code was written during the hackathon. These parts come from before it or from other projects:

- The design rules of `frontend/` and its quiet scrollbar style come from elastic-ui, a component
  library by José, who wrote it before the event. They were rewritten for this project and only
  the static rules were kept.
- `frontend/src/model/catalog.ts` ports the product family rules of `backend/sensei/catalog.py`.
- The interface uses React, Vite, Tailwind CSS, shadcn/ui, Base UI, Lucide and country-flag-icons,
  all under the MIT licence. The versions are in `frontend/package.json`.

## Leaderboard

Every approach scored the same way on the team benchmark (5 folds of whole photos, challenge points). Rules and how to add a row: [LEADERBOARD.md](LEADERBOARD.md). Refresh with `python eval/leaderboard.py`.

<!-- LEADERBOARD:START -->
Answer key `labels_v1`: 1929 areas, maximum 3858 points. "≈ /578" scales the total to the 289 hidden validation areas.

| # | Approach | Owner | Labels trained on | Looks at other photos? | Identification | Stock | Total / max | ≈ / 578 | Per area | Last photo, per area | Seconds per photo |
|---:|---|---|---|---|---:|---:|---:|---:|---:|---:|---|
| 1 | Single image + labelled training crops of the same area as references (`single_ref_vitb16`) | Miguel | the key | training crops only | +1905 | +1313 | +3218 / 3858 | +482 | +1.668 | +1.510 | about 3 s, 20 CPU threads (laptop) |
| 2 | Single image: CLIP ViT-B-16 + colour + area id, logistic regression (`single_vitb16`) | Miguel | the key | no | +1896 | +1315 | +3211 / 3858 | +481 | +1.665 | +1.503 | about 3 s, 20 CPU threads (laptop) |
| 3 | Single image: CLIP ViT-B-32 + colour + area id, logistic regression (`single_vitb32`) | Miguel | the key | no | +1908 | +1297 | +3205 / 3858 | +480 | +1.661 | +1.543 | 0.8 s, 2 CPU threads (laptop), no GPU |
| 4 | Always "right product, full" (`baseline`) |  | none | no | +1653 | -99 | +1554 / 3858 | +233 | +0.806 | +0.344 | 0 |
<!-- LEADERBOARD:END -->

## Built at

<p align="center">
  <sub>Built at JunctionX Lisbon 2026, for the Sensei challenge.</sub>
</p>

<p align="center">
  <img src="assets/partners/junctionx.png" alt="JunctionX Lisbon" height="56">
  &nbsp;&nbsp;&nbsp;
  <img src="assets/partners/sensei.png" alt="Sensei" height="56">
</p>

<p align="center">
  <sub>The JunctionX Lisbon and Sensei logos belong to their owners.</sub>
</p>
