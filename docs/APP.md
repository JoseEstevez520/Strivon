# App

The app is for a store employee starting a shift. It has to show what needs doing, quickly and clearly.

## What it shows

Each task is an action for the employee, with where it is and how old the photo is.

```
[photo of the area]
Restock banana
Camera 6215 · area 2
Photo from 14:20 · 25 min ago
```

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

On a laptop, the full camera photo and the task list sit side by side.

- The photo shows every area painted with its group colour: red for Restock, purple for Move back, orange for Later, green for All good.
- Tapping a card highlights its area on the photo. Tapping an area opens its card.
- A camera selector at the top (there are 14 cameras).
- A bar under the photo to move through the photos of the day.

On a phone, the list comes first. Tapping a card opens the photo with that area highlighted.

All text in the app is in English.

## Data

The app only reads `outputs/predictions.json`:

```
{camera: {image.jpg: {area_id: {planogram_compliant, stock_level, stock_value, fill_raw}}}}
```

- Image names are Unix timestamps, shown as a time of day.
- Product names and area polygons come from `planogram.json`. Names are Portuguese catalogue names ("BANANA CAT I CNT KG") and the app shows a plain one ("Banana").
- The app never assumes values. Extra fields are optional, and the format does not change without telling whoever builds the app.
