# Components

One picture for each piece of the interface, cut out of the real app by a headless browser at twice
the pixel density. Each has two files: `name.png`, with the app's background and a small margin,
and `name.transparent.png`, with no background, to place over a slide. The text is dark, so use the
transparent ones on a light background. The photo pieces, the Real grid, the stop cards and the area tiles come
only as transparent files, because their neighbours show in a margin.

The shelf states in them are simulated: the app draws invented empty, half full and wrong-product
areas over the real camera photos. The photos belong to the Sensei challenge and are reduced.
The plan shows only the areas that have a problem, so there are tiles for empty and wrong product
and none for the others.

## Navigation and controls

| File | What it shows |
|---|---|
| `header-nav` | The top bar: logo, Tasks, Products and Insights, and the language picker |
| `language-picker` | The language picker |
| `day-bar` | The day bar with the play button, the clock and the slider |
| `view-switch-2d-3d-real` | The switch between the plan, the 3D store and the real photos |
| `start-the-round-button` | The button that starts the round |

## Tasks page

| File | What it shows |
|---|---|
| `plan-2d`, `plan-2d-frame` | The plan of the store with its gondolas, with and without the margin around the frame |
| `gondola-block-4-stop-1`, `gondola-block-13-stop-2`, `gondola-block-10-stop-3` | A gondola box that is the first, second and third stop of the round |
| `gondola-block-1`, `gondola-block-2`, `gondola-block-3` | A gondola box that is not a stop |
| `gondola-block-6-all-fine` | A gondola box with nothing to do, in green with a check |
| `area-tile-empty`, `area-tile-wrong` | One shelf area, empty (with the red badge) and in the wrong place (with the return arrow) |
| `stop-list-go-first`, `stop-list-to-bring` | The round list on each of its two tabs |
| `stop-card-1`, `stop-card-2`, `stop-card-3` | One stop of the list, with its products as chips |
| `photo-grid-real` | The latest photo of every gondola, as shown by the Real view |
| `store-3d-front`, `store-3d-corner` | The 3D store seen from the front and from a corner |
| `store-3d-hover-gondola` | The 3D store from a corner with the pointer over a gondola, which opens its list of products |

## Gondola page

| File | What it shows |
|---|---|
| `photo-stage-6215`, `photo-stage-6371`, `photo-stage-6443` | The camera photo with the shelf areas drawn on it, for a banana, a melon and a tomato gondola |
| `gondola-problem-list-6215`, `gondola-problem-list-6371`, `gondola-problem-list-6443` | The problems of the gondola in plain words, one line for each product |
| `gondola-header-6215`, `gondola-header-6371`, `gondola-header-6443` | The name of the gondola and what it holds |

## Products page

| File | What it shows |
|---|---|
| `products-title-search` | The headline and the search box |
| `products-filters` | The filters by state and by gondola |
| `product-card-<name>` | The card of one product (strawberry, green pepper, red grapes, red pepper, pumpkin, melon, banana, tomato, potato, kiwi, onion, mango), with its ring chart, counts, where to bring it or put it back, and since when |

## Insights page

| File | What it shows |
|---|---|
| `insights-headline` | The headline with the share of the time that shelves were empty |
| `insights-stock-over-time` | The map of stock by product and hour |
| `insights-products-empty-longest` | The products empty the longest, as bars |
| `insights-gondolas-empty-longest` | The gondolas empty the longest, as bars |
| `insights-product-check-line` | The line with the share of the time that areas held the product the planogram expects |
