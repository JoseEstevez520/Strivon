# App

The app is for a store employee starting a shift. It has to show what needs doing, quickly and clearly.

## What it shows

Each task is an action for the employee, with where it is and when it was seen.

```
[crop of the area]   Banana                 18:04
                     with Orange / citrus
```

The group above the card says the action ("Restock"), so the card says the product, where it is
and the time of the photo.

Tasks go in four groups:

| Group | Action | Comes from |
|---|---|---|
| Restock | "Restock banana" | `stock_level: empty` |
| Move back | "Put apple back in its place" | `planogram_compliant: false` |
| Later | "Check later" | `stock_level: half` |
| All good | folded away | `stock_level: full` |

- The verb comes first, then the product and the place.
- The time is on the card, because each camera has its own latest photo. A line at the top shows the time of the newest photo in the store.
- `half` is not urgent, so it goes in Later and not with what needs doing now.
- Every card shows the crop of the area, so the employee can check the alert at a glance.

## Layout

The app has four pages and a header with the language picker.

- Tasks is the first page. The list of what to do is on the left, grouped by action and ordered by
  urgency. The long groups show their most urgent cards and fold the rest. On the right are all the
  cameras, and opening a task shows the photo of its camera with the area marked.
- Gondolas shows the 14 cameras, each with how many areas are in each state. A gondola opens into
  its photo and its own tasks.
- Products shows the stock of each product summed over all its areas, with a search.
- Insights is for whoever runs the store: the share of the time shelf areas were empty, a map of
  stock over time, the products and gondolas empty the longest, and a field to ask about the store.
  It says which period the photos cover, and it is an estimate from about 13 photos per camera.

A bar to move through the photos of the day sits with the photos. The outlines on a photo use the
group colours: red for Restock, amber for Move back, grey for Later, green for All good.

On a phone the list comes first and the pages move to a bar at the bottom.

All text in the app is in English, with Portuguese and Spanish selectable. The rules for how it
looks, and the decisions behind them, are in `frontend/DESIGN.md`.

## Data

The app is meant to read `outputs/predictions.json`:

```
{camera: {image.jpg: {area_id: {planogram_compliant, stock_level, stock_value, fill_raw}}}}
```

- Image names are Unix timestamps, shown as a time of day.
- Product names and area polygons come from `planogram.json`. Names are Portuguese catalogue names ("BANANA CAT I CNT KG") and the app shows a plain one ("Banana").
- The app never assumes values. Extra fields are optional, and the format does not change without telling whoever builds the app.

Today the app reads the real photos and planogram from a local folder while it is developed, and the
stock and compliance of each area are simulated with this same shape. Connecting the real
predictions is the next step.

## Calibration

People disagree on what "half" means, and it changes by product. Calibration lets each person
say it for each product, and the app maps the model's stock to a level with that.

Each product has a slider and three buttons (Empty, Half, Full). The slider is a marker for an
amount, and the button says which level that amount is. A product nobody has marked shows the
model's own level, so until someone sets a marker the app shows exactly the answers the model
gave (the same ones we submit).

The amount comes from the model: fill = 0.5 · p(half) + p(full), from the `p_stock` that
`agents/predict.py --p-stock-out FILE` writes next to each answer. Point the app at that file
(`STRIVON_PREDICTIONS=FILE`). A file without `p_stock` still works, with the fill read from the
level (empty 0, half 0.5, full 1). It is the model's estimate of how full the crate looks, learned
from our empty, half and full labels, not a measured percentage.

A marker sets two lines: an amount up to the empty line is empty, from the full line it is full,
and half in between. The model's own lines are 30% and 74% (they give its answers within 2 points
on our 1947 labelled areas).

- Full at v: full from v, empty up to v · 30/74. Orange at 25% and Full: empty up to 10%, full from 25%.
- Empty at v: empty up to v, full from v · 74/30 (at most the top). Orange at 25% and Empty: full from 62%.
- Half at v: the model's lines, moved just enough to keep v in the middle. Orange at 25% and Half: empty up to 24%, full from 74%.

Halves round up (floor(x + 0.5)), as in the predictor.

Big fruit and cabbages are counted in pieces of their own crate, because a percentage means little
there: pieces = fill × capacity, rounded. The capacities were counted by eye on one full photo:
melon 3, watermelon 4, papaya 7, pineapple 6, pumpkin 12, white cabbage 8, red cabbage 6,
cauliflower 6. Everything else uses percent.

Two ready-made profiles sit above the list: Strict (full from 80% of the crate) and Relaxed (full
from 40%), plus a button to go back to the model's levels. Switching between them shows the same
store changing.

The markers are kept in the browser's localStorage under `strivon.calibration.v2`, so they stay on
that device and are not shared. **Export calib.json** writes them, with both lines spelled out per
catalogue product, in the file format of the predictor's calibration option.

The scored run never uses a calibration: it is the plain command in `docs/VALIDATION_DAY.md`, and
its last line must read `OK (stock model mix): 289 areas`. The model output is not touched; only
the step that turns the fill into a level changes, and only in the app.
