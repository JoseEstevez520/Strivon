# Design notes

The decisions behind the Strivon staff screen, each with its reason. Read this before you
change anything visual. When you decide something new, add it here in the same commit, so the
next change starts from what we already learned and not from a blank page.

## What the screen is for

A store employee opens it at the start of a shift and needs to see what to do. The challenge
judges score how clearly and how quickly that reads, and the score only breaks ties, but it is
the part of the work people see. The store has 14 cameras and about 150 shelf areas, so the
interface has a few pages, as the first web did, with the design rebuilt. The team's own tools
(labelling and scoring) stay in the old interface under `/tools`.

## Pages

The pages are the structure of the first web, kept because they fit what the staff do. The
interface of that web was the problem, not its pages.

- Tasks is the first page. The list of what to do is on the left, grouped by action. On the
  right are all the cameras with their latest photo and a strip of their state, and when a task
  is open the panel shows the photo of its camera with the area marked, and a way back to all
  cameras.
- Gondolas shows the 14 cameras as tiles, the ones that need someone first. A tile opens the page
  of that gondola: its photo, and its own tasks with every area that is fine.
- Products shows the stock of each product summed over all its areas, the ones running out first,
  with a search. A product opens into the places where it sits.

The day bar is not in the header. It sits where the photos are, under the camera panel on the
first page and on a gondola page, and under the headline on the pages that have no photo. The
moment it chooses is shared by every page.

## Where the rules come from

The visual rules come from elastic-ui, José's own design system. We keep its static rules and
leave its motion out.

Kept: depth from tones instead of borders and shadows, fields drawn as trays, five type sizes
and three weights, small radii, colour only for outcomes, icons only where they help, and
Lucide for icons.

Left out: morphs, glass, the aurora, layout animation and blur. They are the reason elastic-ui
lags, and this screen recalculates the whole list every time the day bar moves.

Where we differ on purpose: the neutrals are warm, taken from Sensei's site, where elastic-ui
uses cool greys. There is no accent colour. Only the light theme exists for now.

## Tokens

All of them live in `src/index.css`.

| Token | Value | Use |
|---|---|---|
| `bg` | `#f8f7f4` | the page |
| `surface` | `#efeee9` | cards, trays, the detail panel |
| `sunk` | `#e6e4dd` | the day bar track |
| `raised` | `#ffffff` | a hovered card, an open picker |
| `fg` | `#1d1d1d` | text that matters |
| `fg-secondary` | `#51554c` | text that goes with it |
| `fg-muted` | `#686d62` | text beside the point |
| `danger` | `#c4452f` | restock |
| `warning` | `#b7791f` | move back |
| `success` | `#3f8a4f` | all good |

## Type

Five sizes and nothing between them: display 28, title 20, copy 16, label and ui 14, meta 12.
Weights are 400 to read, 500 to act or scan and 600 to announce. A second line is greyer, not
smaller. Times and counts use tabular figures so columns line up.

## Colour

The screen is grey and warm. Colour means a state and nothing else.

- Restock is red, move back is amber, later is grey and all good is green.
- A card that asks for action takes a soft tint of its colour, 13% at rest and 19% on hover and
  while open. There is no border. The tint is how elastic-ui's warning callout works.
- The icon next to each group heading carries the colour. The heading text stays grey.
- Small text on a tint uses `fg-secondary`. `fg-muted` has a contrast of 4.96 on the page and
  4.57 on `surface`, but it drops to between 3.4 and 4.3 on the tints, which is under the 4.5
  that small text needs. `fg-secondary` stays between 4.95 and 6.2 on every tint.
- Outlines of the shelf areas on the photo use the same state colours, because there the
  colour is the information.

## Cards

A card says each thing once. The group heading already says the action, so the card does not.

- The product name leads and sits centred when it is alone.
- The time of the photo is at the right edge, in `fg-secondary`, followed by a chevron.
- The thumbnail is a crop of the real photo showing the area.
- A product that is short in several areas is one card, so a whole store of tasks stays short.
  Its second line says how many ("3 areas") and opening it lists where, one line per gondola.
  Misplaced products stay one card per area, because each is a different wrong thing.
- A second line appears only when it carries news. For one area it says where, by the other
  products of its gondola ("with Cabbage"), without repeating the card's own product. If the
  gondola holds only that product, there is no second line. Move back adds what is there
  instead ("Looks like Kiwi"). Where an area is matters because the list covers the whole store.
- The thumbnail takes a little of the card's colour so the card reads as one object.
- Later is not a card. It is a plain line with the product on the left and where on the right.
  All good is a single line with a count.

We compared three layouts and chose the second: name and time on one line with the reason
under it, name alone with the time as the right edge, or elapsed time as a large figure. The
second has the least text, which was the complaint about the first version.

## Pickers

The language selector is a tray without a fill at rest. The fill appears on hover
and when open. The trigger shows only the flag, which takes little room, and the open list is wide enough for
flag and name. A picker that shows its value keeps its list exactly as wide as its trigger.
The list sits on `raised` with a hairline and a very faint shadow. It opens with Base UI's documented popup transition, a fade and a
scale from 0.97, 200 ms in and 150 ms out. The highlighted option goes one tone up and
the chosen one has a check on the left, with room reserved so options line up whether chosen
or not.

Languages have a flag before the name. Flags keep their own 3:2 size and are excluded from the
rule that forces icons to 16 px. Order is English, Portuguese, Spanish.

## Time

The photos of a camera come about every hour, 13 in the day, and nothing between them is known. So a
time on a card is when we first saw that state, not when it began. We show the clock time and
put "since 15:20" in the tooltip, and we avoid wording like "for 25 min" that claims more
precision than the data has. The camera caption shows the time of the photo being displayed,
because each camera has its own latest photo.

## The day bar

One stop for each moment any camera took a photo, so scrubbing jumps from real photo to real
photo. Moving it by hand stops the play button. Play steps forward about once a second and
stops at the end. Still to do: tick marks at each stop, arrow keys, and a larger touch target
for the handle.

## Data

The cameras, the shelf areas and the photos are the real ones. In development the Vite server
reads them from a folder outside the repository, read-only, set with `STRIVON_DATA_DIR` (it
defaults to the main checkout's `data/` folder). The challenge data is never copied into the
repo or the build. If the folder is not there, the screen falls back to invented shelves of the
same size.

- Product families come from the catalogue names with the rules of `sensei/catalog.py`, ported
  to `src/model/catalog.ts` in the same order. A change there needs the same change here.
- What the pipeline says about each area (stock and whether the product is right) is still
  simulated, in `src/model/simulate.ts`, with the pipeline's shape. The photos are real and the
  states are not, so a shelf marked empty can show a full one until the real predictions are
  connected.
- A crop is the full photo shifted and scaled with CSS to show one area. It is not rectified like
  the pipeline's crop, and every crop of a camera reuses the same file.

## Opening a task

Pressing a card opens it in place and shows how its area went through the day. There is no
separate panel. Pressing it again, or Escape, closes it.

- It is one object with one colour. The card keeps its tint, at 19% while open, and the history
  sits inside it. A panel somewhere else on the screen showed a second shade of the same red,
  and on a laptop it sat below the fold.
- An area picked on the photo opens its own row, and the page scrolls once to bring it into
  view. Picking from the list never scrolls, because the user is already looking at the row.
  The scroll is done from the click handler. An effect that scrolled whenever a row opened
  fired again each time a row remounted and made the page jump.
  Later areas open on the neutral tone. Areas that are fine have no card, so they open as a
  row under the "All good" heading.
- Inside, only the strip of the day: one segment per photo of that camera. Green is full, grey
  is half, red is empty. A thin amber bar marks the photos where the product was in the wrong
  place. Pressing a segment moves the whole screen to that time. There is no line with the
  camera, the area number or the stock level. The camera is already in the picker and under the
  photo, the area is marked on the photo, and a number such as "area 3" means nothing to the
  person on the floor.
- It opens and closes with a short height animation, 200 ms to open and 150 ms to close, and
  the chevron turns 90 degrees in step. It is shadcn's `Collapsible`, which sits on Base UI: it
  exposes the panel height as a variable and marks the first and last frame, and we animate
  between them. The list pickers open with the same times.

## Motion

Colour changes take 150 ms and the open picker fades. A task opens and closes with a height
animation (200 ms in, 150 ms out) and its chevron turns. That is the only layout animation, and
it is kept to one row at a time. No blur, no scaling and no glass. Closing is always a little
faster than opening, as in elastic-ui. With reduced motion, everything is instant.

## Performance

The list and the polygons are recalculated on every step of the day bar, so keep them cheap.
No `backdrop-filter`, no animated filters, no shadows beyond the picker's. Images load lazily.

## Language

The interface is in English, with Portuguese and Spanish. Product names come from a dictionary
by product family, because the catalogue names are Portuguese ("BANANA CAT I CNT KG"). Labels
stay short, since a translation can run longer. The choice is saved in the browser.

## Before building anything

Look for what already exists before writing a component or a helper: first the repo, then the
packages we already have (Base UI and shadcn cover most of what a screen needs), then the
registry and GitHub. Write our own only when nothing fits, and say what was searched. We built
a collapsing block by hand once, and Base UI and shadcn already had it.

## Before calling a component done

- It reads at a glance, and it says nothing twice.
- It works at the longest label in the three languages.
- It has a visible, quiet keyboard focus and works with the keyboard.
- Small text meets 4.5 contrast on its own background, including on a tint.
- Touch targets are at least 44 px, or the action is also reachable from the list.
- It uses only the tokens above, no values of its own.
- It was compared with this document, not only with the last thing built.

## Decisions log

- 2026-10-10. Palette: warm neutrals from Sensei's site, no brand colour. A black accent for
  the selected state was tried and dropped as too heavy. Selection raises the tone instead.
- 2026-10-10. State colour moved from coloured pills and dots on every row to one icon per
  group plus a soft tint on the urgent cards. The first version had too many colours and the
  same card repeated.
- 2026-10-10. Card layout: chose the one with the least text. Reason: the first version put
  "Empty · since 19:14" on one grey line, which looked unbalanced, and said "empty" twice.
- 2026-10-10. Selectors without a fill at rest, and a list as wide as its trigger. Native
  `<select>` was replaced because its list looked out of place.
- 2026-10-10. Muted text darkened from `#7a7e72` to `#686d62` after measuring contrast.
- 2026-10-10. Area detail rebuilt after a review: the first version used label and value pairs
  and repeated what the list said, and it did not apply what we had learned from the card.

- 2026-10-10. Area detail takes its card's tint instead of a fixed grey panel. A grey block
  under the photo read as something separate from the card that was pressed.
- 2026-10-10. The detail panel under the photo is gone. The task opens inside its own card.
  Two reds side by side looked inconsistent, and the panel was off screen on a laptop. This
  also covers phones, since the list comes first and the card opens where it is.

- 2026-10-10. Opening and closing a task animates its height, and the chevron turns instead of
  swapping icons. The first version opened with a short animation and closed at once, which
  felt uneven. Both directions now animate, closing slightly faster.

- 2026-10-10. The hand-made collapsing block was replaced by shadcn's `Collapsible` (Base UI),
  after being told to search first. Same look and times, and it brings the accessibility
  attributes and the unmounting of closed content for free.

- 2026-10-10. Scrolling into view happens only when an area is picked on the photo, and once.
  The first version scrolled on every opening from an effect, which felt like the page was
  moving by itself.

- 2026-10-10. The picker list no longer animates its height. Mimicking the task opening with a
  grid row and an inner scroll container made the list scroll by itself while it grew, because
  the browser brought the highlighted option into view in a box that was still small. It is
  back to shadcn's stock structure with the fade and scale that Base UI documents. Rule: do not
  wrap a Base UI popup in structure of our own to animate it.

- 2026-10-10. Removed the "Camera 6215 · area 3 · Full" line from the open task. It repeated
  what the picker and the photo caption already say, the area index is internal, and "Full"
  next to "Looks like Kiwi" read as if the pear were full. Rule: do not show internal ids.

- 2026-10-10. Pages again, after the camera picker failed: with 14 cameras a dropdown was doing
  navigation, filtering and summary at once. The structure of the first web was right and its
  interface was not, so the pages come back as Tasks, Gondolas and Products. The camera picker
  is gone and the cameras are shown as tiles.
- 2026-10-10. The day bar moved out of the header. It was not clear why the time sat at the top
  of every page, so it now sits with the photos.
- 2026-10-10. Tasks are grouped by product and the store is simulated at its real size. At 35
  tasks the first version was a wall of cards, with the same product repeated and a page 4000
  pixels tall. The simulation had only 18 areas and hid the problem.
- 2026-10-10. Real photos from the local data folder, with crops and camera tiles. They change how
  the screen reads: it looks like a store and not a diagram.
- 2026-10-10. The language picker shows only the flag, to take less room.

## Open questions

- The English flag is the UK flag. A code such as EN would avoid the question of which country
  English belongs to.
- The real predictions need to replace the simulated states.
- Whether uncertain "move back" items should go in their own group, since a false alarm costs
  staff time and trust.
- On a phone the photo comes after the list. A short link from an open card to the photo may
  be needed.
- The list changes height as the day plays, and the browser clamps the page scroll when it gets
  shorter. A minimum height for the list column may be needed.
- A products view, with stock summed per product.
