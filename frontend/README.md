# Frontend

The web for store staff. It shows what to do across the whole store, every gondola with its camera
photo, and the stock of each product. It is built with React, Vite, Tailwind v4 and shadcn/ui.

There are four pages. Tasks lists the work, grouped by action and ordered by urgency, beside the
cameras. Gondolas shows the 14 cameras and what each one needs. Products shows the stock of each
product summed over all its shelf areas. Day says how the day went, with a field to ask about it.
`DESIGN.md` has the rules for how it looks and the reasons
behind each decision.

## Run it

```bash
npm install
npm run dev -- --port 5180
```

Then open http://127.0.0.1:5180.

The photos and the shelf areas belong to the challenge, so they are not in this repo. In
development the Vite server reads them from a folder outside the source, read-only. By default that
is `data/` at the root of the repo, laid out as the setup guide says:

```
data/planogram.json
data/images/<camera>/<timestamp>.jpg
```

To use another folder, set `STRIVON_DATA_DIR`:

```bash
STRIVON_DATA_DIR=/path/to/data npm run dev -- --port 5180
```

If the folder is missing, the screen shows invented shelves of the same size, so the interface
still works.

## What is real and what is not

The cameras, the shelf areas and the photos are the real ones. What the pipeline says about each
area (its stock level and whether the product is the right one) is simulated in
`src/model/simulate.ts` with the same shape as the pipeline's output. Until the real predictions
are connected, a shelf marked empty can show a full one in the photo.

The `/api` requests are proxied to the pipeline's server on port 8000, for when the real data
replaces the simulation.

## Build

```bash
npm run build
```

The build does not include the challenge data, so the built version cannot show photos until a
server provides them.

## Where things are

- `src/pages` the three pages.
- `src/components` the parts they are made of. `src/components/ui` comes from shadcn/ui.
- `src/model` the data: types, the real and the simulated sources, product families and their names
  in English, Portuguese and Spanish.
- `src/lib` shared logic: the store of state, the task rules, the translations and small hooks.
- `src/index.css` the design tokens and the quiet scrollbar.

Do not name a folder `data` in here. The root `.gitignore` ignores `data/` at any depth and would
hide it.
