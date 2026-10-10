<p align="center">
  <img src="docs/banner.png" alt="Strivon: every shelf tells you what it needs before it runs empty" width="100%">
</p>

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
