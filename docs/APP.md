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
amount, and the button says which level that amount is. If you put the marker on 25% and press
Full, then a crate of oranges that is a quarter full already counts as full. The levels around
the marker follow from it: half of that amount or more is half, less is empty.

Big fruit (watermelon, melon, pineapple, pumpkin, papaya) is counted in pieces in the crate, 0 to
7, because a percentage means little there. Everything else uses percent.

Two ready-made profiles sit above the list: Strict (full only when well stocked) and Relaxed (a
bit of stock is already fine), plus a button to go back to the default. Switching between them
shows the same store changing.

The choices are kept in the browser's localStorage under `strivon.calibration`, so they stay on
that device and are not shared. The model output (`outputs/predictions.json`) is not touched.
Only the step that turns `stock_value` into a level changes, and only in the app.
