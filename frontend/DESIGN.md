# Design notes

The decisions behind the Strivon staff screen, each with its reason. Read this before you
change anything visual. When you decide something new, add it here in the same commit, so the
next change starts from what we already learned and not from a blank page.

## What the screen is for

A store employee opens it at the start of a shift and needs to see what to do. The person is in a
hurry, often has their hands full and has had no training, so the screen has to be easy for the
least patient reader. The challenge judges score how clearly and how quickly that reads, and the
score only breaks ties, but it is the part of the work people see. The store has 14 cameras and about 150 shelf areas, so the
interface has a few pages, as the first web did, with the design rebuilt. The team's own tools
(labelling and scoring) stay in the old interface under `/tools`.

## Pages

The pages are the structure of the first web, kept because they fit what the staff do. The
interface of that web was the problem, not its pages.

- Tasks is the first page. Empty and half full sit side by side, because they ask for different
  things (go now, or when you can), with what is in the wrong place below. To the right, "Go
  first" names the gondola to go to and what it needs, and "Then" lists the next three. Opening a
  task swaps that side for the photo of its camera with the area marked.
- Map shows the store as a plan, one box per gondola, with only what needs doing drawn inside it.
  It is a live view of what the cameras see, so it never asks anyone to mark anything. See
  "Rules we learned" and the log for how it got here.
- Gondolas shows the 14 cameras as tiles, in a fixed order. A tile opens the page
  of that gondola: its photo, and its own tasks with every area that is fine.
- Products shows the stock of each product summed over all its areas, the ones running out first,
  with a search. A product opens into the places where it sits.

- Insights is for whoever runs the store. One sentence leads: what share of the time shelf areas
  were empty. Under it, a map of stock over time, the products and gondolas that were empty the
  longest, and the share of the time areas held the right product. A chat bubble in the corner
  lets you ask about the store.

The day bar is not in the header. It sits under the headline of the pages that show the store at a
moment (Tasks, Gondolas, Products), and under the camera panel on a gondola page. The moment it
chooses is shared by every page. On the Map it moves behind a small control, because the person
on the floor wants the last photo.

## Where the rules come from

The visual rules are static: tones, type, radii and colour. Motion is kept to a minimum.

Kept: depth from tones instead of borders and shadows, fields drawn as trays, five type sizes
and three weights, small radii, colour only for outcomes, icons only where they help, and
Lucide for icons.

Left out: morphs, glass, the aurora, layout animation and blur. They make a screen lag,
and this one recalculates the whole list every time the day bar moves.

Where we differ on purpose: the neutrals are warm, taken from Sensei's site, where cool greys
are the usual choice. There is no accent colour. Only the light theme exists for now.

## Rules we learned

These came from building and rebuilding the map and the first page. Each one cost us a version.

**For the person with the cart**

- One main action per screen. The answer to "what do I do now?" is the biggest thing on it.
- Recognise, do not remember. A product is its icon and its name, never "Orange / citrus" twelve
  times in a row with nothing to tell them apart.
- Colour is never the only signal. Empty has a "!", wrong product has a return arrow, and a fine
  gondola has a check. White on white says nothing.
- Anything you press is at least 44 px, and 48 for the main thing. Text that matters is never
  under 13 px and is never cut off.
- Plain words: "Go first", "Bring", "Empty since 18:22". Not "Wrong product" if "In another
  product's place" says it.
- Little scrolling and nothing to learn.

**The app only watches**

The cameras and the model already see what is empty or misplaced, and the next photo clears the
warning by itself. So the app never asks anyone to mark anything: no "Done", no "No stock", no
progress counters. We built those once, copying a pick-list app, and took them out. A live view
should say it is a live view: what you see is the last photo, and it updates with the next.

**Draw only what needs doing**

What needs no action is not drawn. The map shows the tiles of what is empty or in the wrong
place. Fine areas and half full ones stay out of it. They are in the panel, one touch away. A
first version drew one tile for each of the 150 areas and it was noise.

**Say each thing once**

- A count that the tiles already show is not repeated as a chip.
- A name that the drawing already says is not written again: no "Entrance" over a door, no "All
  fine" next to a check, no department sign over a department, no aisle names when the gondolas
  have numbers.
- A line of the products under each gondola name was crowding it, so it lives in the panel.

**Tone over lines, flat over ornament**

- Lines stacked on lines (a grid in the floor, dashed lanes, a dotted route, dashed outlines on
  the tiles and a ring on the selected box) added nothing. Separation comes from tone and space.
- No skeuomorphism: no poles or chains on signs, no speech-bubble tails, no 3D, no mats with
  stripes. The store feel comes from structure (an outer wall, an opening, rows of gondolas).
- No black as a highlight. Dark headers, a black "go first" card and black markers all looked
  like foreign bodies. The first gondola to visit stands out by size, a lighter tone and a number.
- Colour is for outcomes. A soft red for empty, a soft amber for the wrong product, a soft green
  for a gondola with nothing to do, at the same strength, so the worst can still be told apart.

**Same things look the same**

- Objects of one kind (the gondolas) have one size and sit on one grid: the header at the top,
  the tiles from the same height, and any secondary line anchored in the same corner of every box.
  Boxes that shrink to their content looked uneven.
- They need contrast against the floor. Light boxes on a darker flat floor.

**Responsive means reflow, not shrink**

A drawn plan with fixed proportions does not fit a phone. The map is a layout of boxes that
reflows: the plan on a wide screen, three or four columns on a tablet, and on a phone two columns
in the order of the round, most urgent first, with the first one wide and carrying what to bring.
The same box is used at every width. Test at 1440, 768 and 390 and look at the result.

**How we work**

- We try ideas as pages in the lab (`/lab`, `/lab/home`, `/lab/map`), side by side with real data,
  before touching the app. Nothing from the lab goes to main without being chosen.
- Several agents can propose different directions, and a critic can review them. Their reports are
  opinions. Look at the screenshot yourself: more than once an agent said a change was done and it
  was not.
- Research in the web is cited only from pages that were opened, and we say what was not verified.
- When we decide something, it goes here in the same commit.

## Header and navigation

The header is opaque, 48 px tall and spans the whole width. The name is on the left, the language on the right
and the pages in the middle, each with an icon and its label. The page you are on is the one in
the text colour and the others are grey. There is no underline and no filled shape. A hairline appears under the header only once the page has moved. It does not
shrink or hide: it is already small. The window itself does not scroll. The content under the
header scrolls in its own container, so the scrollbar starts below the bar and the bar is never
cut by it.

On a phone the pages move to a bar at the bottom, with the icon over the label and the active one
in the text colour. The first version had plain links with a tinted pill next to the
name, which was neither a tab nor a button and broke the calm of the page.

Group headings in the lists stay fixed under the header while their group scrolls, on an opaque
background. The panel stays in view beside the list and never decides how tall the page is. The grid of
cameras is taller than a screen, so it scrolls inside the panel. If the panel set the page height,
opening a task would swap a tall grid for one photo, the page would shrink and the browser would
move the scroll under the person's finger.

Sources, read on 2026-10-10: NN/g on sticky headers (opaque, as small as possible, shrink only
for a large logo) and Android's guide to navigation (a bar of three to five destinations on a
phone, horizontal items on a medium screen). Other claims from the research, such as the order
of tiles and the width of the panel, come from sources that were not opened.

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

- Restock is red, move back is amber, later is grey and all good is green. There is no black or
  brand colour as a highlight.
- A card that asks for action takes a soft tint of its colour, 13% at rest and 19% on hover and
  while open. There is no border. The tint takes the place of a border.
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
  instead ("Looks like Kiwi"). Where an area is matters because the list covers the whole store. On a gondola's own page the
  place is left out, since everything there is already in that gondola.
- The thumbnail takes a little of the card's colour so the card reads as one object.
- Later is not a card. It is a plain line with the product on the left and where on the right.
  All good is a single line with a count.

A long group shows only its most urgent cards and folds the rest behind a line ("Show 12 more").
Restock shows 6, Move back 4, and Later starts folded because it is what can wait. The
heading carries the total, in products, so the size of the job is known without seeing it. An
area picked on the photo that sits in the folded part opens the group by itself. A gondola's own
page does not fold, since it holds few. The first screen was a wall of 31 tasks and a page 4000
pixels tall before this, and a worker starting a shift needs what to do now and not the whole list.

We compared three layouts and chose the second: name and time on one line with the reason
under it, name alone with the time as the right edge, or elapsed time as a large figure. The
second has the least text, which was the complaint about the first version.

## Gondola tiles

A gondola is named by a number, "Gondola 4", in the order of the cameras. The two products that
fill most of it go in a quiet second line where there is room. The numbers are placeholders until
the store gives us its own.

A tile is a camera, and nothing goes over its photo. The photo is the proof of what the app says,
and the lower shelf is where the stock shows, so it sits whole in a quiet box. Under it, in one
row, the name on the left, which may take two lines instead of being cut off, and on the right how
many areas are in each state, with the same icons the group headings use (alert for restock, arrow
for move back, clock for later), each with its number. A state with none is left out, and a
gondola with nothing to do says "All good" in grey. The row is centred in the space under the
photo, so tiles with a one-line name and tiles with two keep the air balanced. The full name is in
the tooltip.

Over a photo there are only the outlines of the areas. A light piece of the page tone over the
photo was built and rejected because it covered the shelf, and gradients, dark pills and coloured
badges were rejected because they are overlays and pills, which the rest of the interface does not
use. A box with the content packed to the left looked unbalanced, and a horizontal tile like a task
card was not liked.

The tiles are context and the task cards are the work, so the cards are the ones that carry
colour. The tiles carry only the small coloured icons.

The order is fixed, by camera, and does not follow urgency. The staff learn where each gondola
is, and tiles that jump around as the day bar moves make that impossible.

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
defaults to the repo's own `data/` folder). The challenge data is never copied into the
repo or the build. If the folder is not there, the screen falls back to invented shelves of the
same size.

- Everything groups by family, because the name on screen is the family name. The planogram has
  94 catalogue ids, and two ids of one family (two kinds of red apple) would show as two cards
  with the same name. The catalogue id is not used by the interface.
- Product families come from the catalogue names with the rules of `backend/sensei/catalog.py`, ported
  to `src/model/catalog.ts` in the same order. A change there needs the same change here.
- What the pipeline says about each area (stock and whether the product is right) is still
  simulated, in `src/model/simulate.ts`, with the pipeline's shape. The photos are real and the
  states are not, so a shelf marked empty can show a full one until the real predictions are
  connected.
- A crop is the full photo shifted and scaled with CSS to show one area. It is not rectified like
  the pipeline's crop, and every crop of a camera reuses the same file.

## Urgency

The order of the cards is the order of the work, so what defines it is explained, but not written
on the page: it shows as a tooltip on the headline, since a standing line was clutter. A product's urgency is how much of it is gone across the whole
store: an empty area counts 1 and a half-empty one 0.5, divided by the areas it has. A product
that is out everywhere cannot be bought at all, so it comes first. When two products are equally
short, the one that has waited longer goes first, which is the time shown on the card. The camera
only decides what is still tied. Inside a card, the areas that have waited longest come first.

Move back has no confidence to order by yet, because the simulated states carry none. The
pipeline gives a probability of mismatch, and the lowest should go first when it is connected.

## The Insights page

It answers how the store is doing, with figures that are true of the data and no more. It is not a
page about one day. The data we have covers one day, and the page says which period it covers, in
one line written from the data ("Jun 27, 2025, 06:12 to 20:16"), so it never claims a period it
does not have. Nothing in the copy says "today". With more days, the same sections take a longer
period.

- The lead is a share, not a sum. A first version said "487 hours" empty, which is the hours of
  all 152 areas added up and means nothing to a person. "Empty 24% of the time" is understood at
  once, and a share compares products and gondolas with a different number of areas.
- The map has products as rows and hours as columns, in one red hue in four steps by thirds of the
  areas that were empty. A cell that no camera was looking at is left blank, and nothing empty is a
  quiet tone. The most affected products show first and the rest fold. One hue reads as intensity,
  and a scale with two colours would suggest a middle point that has no meaning here.
- The rankings are bars inside the row, with the label on the left and the percentage on the right,
  in a neutral tone. The number says how much, and colour is kept for what a state means.
- All of it is an estimate. A camera takes about 13 photos in the day, and what happened between
  them is unknown, so each photo stands for half the gap before it and half the gap after it. The
  page says so in one quiet line, and also says when the stock states are simulated. Without real
  predictions this page must not be shown as results.

## The assistant

A field asks about the store, with four suggested questions. A suggestion fills the field and does not
send it, so it can be edited. The assistant is not connected yet and every question gets the same
plain answer. What is built is the part that does not change when it is connected.

- An answer is a list of parts, and each part is one of the app's own components: text, a lead
  figure, a ranking, the day map or a gondola tile. The assistant may only use those. The numbers
  inside are worked out by code from the data, and the model, or the rule, only chooses and arranges.
  This keeps every answer in the same look as the app and checkable against its photo.
- To connect it: first recognise the question by intent with simple rules, which works without a
  network or a key, and returns those parts. Later a model replaces the rule. OpenUI, whose renderer
  only draws the components that are registered, is a fit for that, and the same components are what
  it would register. Whether the challenge allows external APIs decides which model can be used, and
  nothing sent to one should include photos.

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

## Scrollbars

Scrollbars are quiet ones, set as `scrollbar-subtle` in `src/index.css`: a
line of 6 px with no track and no arrows. It is invisible at rest and drawn faintly only while the
area scrolls or the pointer is over the bar itself, a step darker on the line. It was made always
visible once and asked back to this, and then it showed whenever the pointer rested anywhere over
the content, which was still too much: it should show only when you go to it or scroll. They apply to the content area, which scrolls under the header, and to the camera panel. The browser's own bars are
wide and grey and fought with the flat style. The space for the page bar stays reserved so
nothing shifts when it appears.

## Motion

Colour changes take 150 ms and the open picker fades. A task opens and closes with a height
animation (200 ms in, 150 ms out) and its chevron turns. That is the only layout animation, and
it is kept to one row at a time. No blur, no scaling and no glass. Closing is always a little
faster than opening. With reduced motion, everything is instant.

The chat follows the same rules. The box grows from the button on a soft curve (320 ms open, 240 ms
closed) and what is inside resizes with it on the same curve, so enlarging it never makes the
content jump. A new message rises 4 px while it fades in, the answer fades in where the dots were,
and the jump-to-bottom button fades instead of popping.

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

- 2026-10-10. Products group by family and not by catalogue id. With real data the first version
  listed 94 numeric ids, and the same product appeared twice on the first page.

- 2026-10-10. Header and navigation redone: centred pages with icons, an underline for the active
  one, a fixed opaque bar, and a bottom bar on a phone. The first version, plain links with a
  filled pill, was called horrible and broke the style.
- 2026-10-10. The task list became the main column and the cameras the secondary one, because
  what to do matters more than where the gondolas are. Cards sit two to a row, and group
  headings stay fixed while scrolling.
- 2026-10-10. Gondola tiles are tinted when there is something to restock, graded by how much,
  and keep a fixed order. The first sort by urgency made tiles move, and with 12 of 14 tinted
  the same, none stood out.

- 2026-10-10. The active page is marked only by the text colour. The 2 px underline copied from
  the library's tabs was removed because it was not liked.

- 2026-10-10. The panel got a heading of the same height as a group heading, and the gutters of
  cards and tiles became the same 8 px. The first card of the list and the first tile of the
  panel started 35 px apart. A card that opens spans a row, and the grid flows densely so the
  cards after it fill the gap it leaves.

- 2026-10-10. Long groups fold behind "Show N more", with totals in the headings. A worker
  starting a shift needs what to do now, so the first screen shows the most urgent six, four and
  none of the later ones. The page went from about 4000 px to 1600.

- 2026-10-10. Urgency is defined and shown. It was share of the product that is gone, with the
  camera number as a tie-break, which was arbitrary. Ties now go to what has waited longest. A
  line under the headline said so, and was removed as clutter, leaving a tooltip.

- 2026-10-10. Opening a task no longer makes the page jump. Measured before the fix: the page
  shrank from 1632 to 1073 px and the pressed card moved 177 px, because the panel changed from
  a grid to a photo and the open card moved to its own row. Now the panel has a fixed height with
  its own scroll and the card opens in its column, and the pressed card stays within 0 px.

- 2026-10-10. Scrollbars are quiet: a thin faint line, always visible, for the content and the
  camera panel, shown only while the pointer is over what scrolls. The browser's default grey bar
  stood out against the flat screen. An always-visible version was tried and not wanted.

- 2026-10-10. Gondola tiles simplified. They had a tinted frame, a red icon and a strip in four
  colours, and the name was cut off by the count. The name now has its own line, the count sits
  beside the strip, the strip colours only what needs action and the tint is lighter.

- 2026-10-10. Gondola tiles lost their tint. With a coloured photo inside, a pink or amber frame
  made too many colours with little contrast, and the tiles are context, not the work. The task
  cards keep their tint, which was liked.

- 2026-10-10. The strip of coloured lines on the tiles became icons with counts. Nobody could say
  what the short lines meant, and the group icons already mean restock, move back and later
  elsewhere on the screen.

- 2026-10-10. The quiet scrollbar became thicker, 6 px instead of 3, so it can be grabbed and seen.

- 2026-10-10. The page no longer scrolls as a whole. The bar is shorter, 48 px, and the content
  scrolls under it, so the scrollbar starts below the header and does not cut it.
- 2026-10-10. Gondola tiles: the photo whole in a quiet box with the name and the counts in one row
  under it. A light piece over the photo was chosen first and then rejected because it covered the
  image, so everything extra goes outside the photo. A box with the content packed left was too
  unbalanced, and a horizontal tile like a task card was not liked.

- 2026-10-10. A Day page and an assistant field. The page is descriptive and says it is an
  estimate. The assistant is empty on purpose: the parts an answer is made of are built, the
  answering is not.

- 2026-10-10. The logo is a 3×3 of day-map slots with a stretch of gone ones running corner to
  corner, next to the name in lower case. It is the same shape as the hero, the banner and the day
  map, so one idea carries the brand. Red stays for the gone slots. It is also the favicon, and it
  holds up at 16 px, which the wider and the single-row versions did not.
- 2026-10-10. The chat answers with a clean set of parts, as OpenUI's own library does, and each
  one is drawn here: `Text`, `Callout`, `Metrics`, `Ranked`, `Bars`, `Table`, `Trend` (a line by
  hour), `Mix` (one bar of how time split), `DayMap`, `Tasks`, `Where` and `Gondola`. Charts are
  small SVG or plain markup on the same tokens: one colour for an outcome, neutral for the rest,
  no legend boxes or gridlines beyond a hairline. The model is told the product keys, where each
  product sits and which are worst (names only), plus four worked examples, and may never write a
  digit: every figure comes from a part.
- 2026-10-10. What the chat answers leads to its page: a ranked gondola to its gondola, a task row
  to the area open on its gondola, a product to its row on the Products page, which opens and scrolls
  to it. The conversation lives outside the components, so coming back leaves the chat open as it
  was. The thread scrolls like the big chats: it follows the answer while you are at the bottom,
  lets go when you scroll up and offers a button back down. Its two ends fade out with a mask, the
  one place a gradient is used, because a hard cut through a chart reads as an error.
- 2026-10-10. The Map page shows the store as a plan: one block per gondola, tinted by the worst
  thing it has (red for restock, amber for wrong product, neutral when fine, in the same tints as
  the task cards), with the warnings counted in a corner and one small square per shelf area. Pick a
  block and its photo and tasks show beside it; the day bar changes the whole map. We do not have
  the real plan, so the blocks sit in rows; `src/model/layout.ts` holds where each one goes and the
  map follows once it is filled in.
- 2026-10-10. The chat no longer follows the answer down. Sending puts your question at the top of
  the thread and the answer grows below it without the view moving, so it is read from its first
  line, as in the big chats; a round button takes you down when it runs long. The last answer is
  at least a screen tall so that even a short one lets the question reach the top. On a phone the
  enlarge button is hidden: the box already takes the screen.
- 2026-10-11. Tasks has the same day bar as Gondolas, under the headline and above the list, not
  under the gondola panel. One time control, in the same place on both pages.
- 2026-10-11. Tasks is built for the person with the cart. Empty and half full sit side by side,
  because they ask for different things (go now, or when you can), with what is in the wrong place
  below. To the right, "Go first" names the gondola to go to with its photo, what it needs, since
  when it has been empty and what to bring, and "Then" lists the next three. They are ranked by a
  sum over the areas that need something (empty and wrong place count 1, half full 0.5), made up to
  twice as heavy by how long they have been like that and up to twice by how much of the product is
  gone across the store. Opening a task swaps the side for its photo, as before.
- 2026-10-11. Gondolas are named by number, "Gondola 4", fixed in the order of the cameras, with
  the two products that fill most of it as a quiet second line. The old names (the two main
  products) repeated between gondolas, were cut short in tiles, changed with what the model saw
  and are not what anyone in a store says. Places with room for both show "Gondola 4 · Potato ·
  Onion"; the numbers are placeholders until the store gives us its own.
- 2026-10-11. Every shelf area has its product's icon (Fluent Emoji High Contrast, MIT, in
  `src/model/produceIcons.ts`), so what is missing reads without words. A gondola is drawn as a card
  of those icons, one tile per area in shelf order: red for empty with a "!", amber for the wrong
  product with a return mark, grey for half full, white for fine. It sits under the photo of the
  gondola to go to first. On the photo, an area that is empty or misplaced also carries its icon on
  a red or amber disc and empty areas are tinted stronger. That is an overlay on a photo, which these
  rules avoid, so it is an experiment on the Tasks page only, to be judged by using it.
- 2026-10-10. The bubble grows into the chat box and folds back (width, height and radius, 300 ms).
  It is the one exception to "no layout animation", allowed because it is a single small element
  with a fixed-size box inside it, so nothing inside reflows. Blur, glass and aurora stay out. The writing field is a soft tray that grows with the text, Enter sends,
  and the send button is a dark circle that dims while there is nothing to send.
- 2026-10-10. The chat draws its answers with OpenUI (`@openuidev/react-lang`, MIT), using the
  app's own components as its library (`components/chat/library.tsx`). The parts take references,
  never figures: `Stat("empty")`, `Ranked("gondolas", 5)`. Each part computes its numbers from the
  store, so a model can choose and arrange but cannot invent a value. The chat only exists when the
  server has a key (`/api/chat/status`): without one the bubble is not drawn, rather than showing a
  chat that cannot answer. While the answer has not started, three dots fade in turn; once it
  streams, the parts appear as they arrive.
- 2026-10-10. The chat can grow: a button in its corner switches it between a small box and a wide one for charts (the swap is instant). The chat is a round button in the corner of Insights only, not of every page. It
  opens a box that grows from the corner without glass or blur, and closing keeps the conversation. It lives where the answers are, and
  the other pages have no use for it.
- 2026-10-10. The Insights headline puts the number first ("~24% of shelf time was empty"), as the
  other pages do. The "~" says it is an estimate, with the detail on hover, and the period sits in
  a small line on the right with "simulated" while it is. Three disclaimers in a line under the
  title were clutter, and the sentence read like a report.
- 2026-10-10. The Day page became Insights. Naming it after a day, and writing "today" in its
  headline and its chat, closed it to one period when what we want is the analytics of the store.
  The period is now a line of data. A period selector and multi-day code were left out, since they
  could not be tested with one day of photos.
- 2026-10-11. Voice in the chat, shown only when the server has a key. A round microphone sits
  left of Send, in the same quiet tone; while it records it turns red with a stop square, and
  while it transcribes it shows the three dots. The text lands in the field and is never sent
  by itself. A speaker toggle in the corner reads each finished answer, only the sentences of
  its text and callout parts and never the figures of a chart. Escape ends a recording before
  it closes the box. Failures are one short line that clears itself, not a dialog.

- 2026-10-11. The map is a passive live view and was cleaned up in many steps, each with its reason in
  "Rules we learned". We dropped the "Done" and "No stock" buttons because the cameras detect it,
  the dark highlights, the poles and tails, the grid and dashed lines, the count chips, the
  department sign, the aisle names, the entrance label and the "N fine" line. Gondolas became boxes
  of one size on a darker floor, with only their problem tiles inside, and the ones with nothing to
  do a soft green with a check. A 3D view was built and set aside: the team did not want it.
- 2026-10-11. Rules about ease of use were checked against sources that were opened, with the
  caveat that the frontline-worker advice comes from company blogs: Nielsen's heuristics (recognise
  rather than remember, prevent errors), WCAG 1.4.1 (colour is never the only signal), target sizes
  (44 to 48 px for touch, 24 px as the legal floor in WCAG 2.5.8), and one main action per screen.
- 2026-10-11. Pressing a gondola on the map opens its own page instead of a side panel or a sheet.
  The map then takes the whole width and has one job, to show where the problems are. The gondola
  page has the other job: the camera photo with what is empty or misplaced marked on it, and the
  problems in plain words, one line for each product with how many areas and since when ("Orange
  x3, empty since 18:22"), grouped as empty, wrong product and half full. Hovering a line lights its
  area on the photo. There is still nothing to press to mark a task.
- 2026-10-11. The side panel of Tasks was cut down with what we learned on the map. It held a photo,
  a name, a products line, three counts with words, a line of since when and a card with a tile for
  every area, then three more gondolas with their own photo, products and counts. Now "Go first" is
  the photo, the name, since when it has been empty and one tile for each thing that is wrong, and
  "Then" is three lines with a number, a name and how many things are wrong. Fine and half full
  areas are not drawn, the counts and the products line are gone, and the small photos are gone.

## Roadmap

What we want to build next on the interface, in no fixed order. When one of these starts, move
what we decide into the sections above and the decisions log.

- A version for managers. Today the app is built for the person with the cart. A manager asks
  different things: which gondolas keep running out, at what hour, and whether the shifts match
  that. Before designing it we need to find out how stores usually work: how restocking is
  planned, who decides what to reorder, how long a shelf area can sit empty before it counts as a
  problem, and which figures a manager already looks at each day. Write what we find, with its
  source, in `docs/` and design from that, not from guesses. The Insights page is the starting
  point; this version may replace it or sit beside it.
- A store plan with the real layout. The Map places the gondolas on a made-up floor because we do
  not have the plan of the store. When we get it, the order and the rows follow it.
- Improve the panel of the map: the real photo of the gondola with the problem areas marked on
  top, the problems grouped by product ("Orange x6, empty since 19:30") instead of one row each,
  and no list of every fine area.
- Make the map livelier: play the day on it and watch gondolas change colour, search a product to
  light up where it is, mark what changed since the previous photo, and a photo preview on hover.
- Move the chat relay to the pipeline's server, so a built version has the chat and the voice. At
  the moment it only exists in development and on the shared server.

## Open questions

- Who is the screen for in practice: a phone in a hand, or a tablet on a cart? It changes where
  the main control goes. A person on the floor should try it without explanation and we watch what
  they touch first.
- The microphone only works on localhost or over https, and the shared server is http on an
  address.
- The English flag is the UK flag. A code such as EN would avoid the question of which country
  English belongs to.
- The Insights page and every figure on it depend on the real predictions replacing the simulated
  states. Until then it cannot be shown as results.
- Whether the challenge allows external APIs, which decides how the assistant can answer.
- The real predictions need to replace the simulated states. With the simulated ones, 12 of 14
  gondolas have something to restock, which flattens the tiles. The real figures may differ.
- Whether uncertain "move back" items should go in their own group, since a false alarm costs
  staff time and trust.
- On a phone the photo comes after the list. A short link from an open card to the photo may
  be needed.
- The list changes height as the day plays, and the browser clamps the page scroll when it gets
  shorter. A minimum height for the list column may be needed.
- A products view, with stock summed per product.

## Store plan (lab, `/lab/map-store`)

Superseded by "First page: plan, list and 3D" below, which keeps the plan but drops the detail panel and the department sign.

A passive live view. The cameras and the model already detect what is empty or misplaced, and the next hourly photo clears a warning by itself, so the screen never asks the employee to mark anything: no Done, no No stock, no counters. The detail panel is plain information per problem: product, where on the shelf, the state and since when.

From 1024 px it is a top-down plan in HTML and CSS: walls, a door with a mat and an awning, a hanging department sign, aisle lanes with arrows and names, and gondolas as furniture with hanging name signs. A grey dotted line shows the walk. Below that the same gondola block sits in a compact grid in walking order (four columns, two on a phone) and the first gondola spans two columns and carries what to bring, so no second card repeats it. The first gondola is marked by tone, a larger neutral number and the card above the plan, never by black.

Every state has a shape as well as a colour: empty a dashed tile with "!", wrong product a return arrow, half full a filled lower half. Fine areas are plain white tiles with no badge; a green check appears once, on a gondola with nothing to fix. Pure red is kept for a product gone from half the store or more. Sizes are small on purpose (20 px icons, 32 px tiles, 14 px names, nothing under 12 px), because nothing here is pressed except the gondola blocks, which are at least 44 px tall.

## First page: plan, list and 3D

Tasks is one screen. The plan says where, the list says what to carry. The Map and Gondolas tabs are gone (their routes redirect here) because the plan and the gondola tiles said the same thing twice.

The plan is the flat one by default. It is the quickest to read for someone in a hurry, it reflows to two columns on a phone, and it shows only what needs doing. On a phone the list comes first, then the plan.

From 1280 px a 2D / 3D button swaps the plan for a 3D store. The choice is remembered in the browser, and `/#/?view=3d` opens it directly for a demo. The 3D code and three.js load only when the button is pressed. Below 1280 px there is no button: at phone width the whole store is too small to tell the fruit apart, and a two-step tap-to-zoom costs more than the flat plan does.

What we settled on for the 3D, so it is not argued again:
- Shelves rise like stairs toward the back, so every crate shows from above. A tall back wall hid the row behind it, so the wall is only high enough to carry the name.
- Each product is a small solid of its own (about a dozen shapes, coloured by family), not an icon on a tile. An empty crate shows a faint red ghost of what should be there, a half crate holds one piece, a wrong product is the same fruit washed out.
- Empty and wrong crates carry a pin with the product icon above them. The pin is the only thing that asks for attention; fine gondolas get a check, as in 2D.
- Pressing a gondola moves the camera in and lists each product with its count and state; pressing it again opens its page. Escape or pressing the floor goes back. There is no reset button, since those cover it.
- Pointing at a gondola must not cover the scene, so its details sit in a fixed corner card.

The button has a third view, Real: the latest photo of every gondola in a grid, with the marks drawn on each photo, problems first in the order of the round and the fine ones after with the check. Pressing a photo opens the gondola. It shows the shelf as it is, which the plan and the 3D store only stand for, so it is the view for checking a doubt rather than for starting the round.

Only the views that can work are offered. A phone gets 2D and Real, since 3D needs room; a build with no photo source gets no Real. The marks on a small photo are scaled up (about twice) so they stay readable, and they sit in the corner of each area so the product under them stays in view. Two columns on a phone, three on a laptop, four on a wide screen; the photos load as they near the screen.

## The round, for the phone

A worker carries it. It is `/#/round`, outside the header and the tab bar, one step per screen: first what to load from the back room, then one gondola per step, then the end. Type is large (the names are 16 px, the gondola 28), the buttons are at the bottom where the thumb is and 56 px tall, and the screen stays on while it is open. Each thing to carry shows a crop of the real photo of the spot it is for, so someone who does not know the gondola finds the place.

"Previous" and "Next" only move the view. Nothing is marked as done: the next hourly photo clears what was fixed, and the position is remembered in the browser only so a reload does not lose the place.

The order is by need and then by gondola number, as an approximation of the walk, because the floor positions are not known. It is a reasonable order and the page does not claim it is the shortest path. A product standing in the wrong place is matched with the gondola that has its place in the planogram, so the round says "take to Gondola 5" where it is found and lists it as a drop in Gondola 5; with no place in the planogram it says to take it back to the back room. The first screen of Tasks has a "Start the round" button and, on a wide screen, a code to open it on a phone.


## Calibration page

A product nobody has marked says so in one quiet line ("No marker: shows what the model says") and has no level pressed, so the page never suggests a choice the model did not make. Once a level is pressed, the same line spells out what follows ("Empty up to 10% · Full from 25% · Half in between"), because a marker moves two lines and the person should not have to guess the second one. "Back to the model" on the row undoes one product; the reset at the bottom undoes all. Big fruit and cabbages count pieces up to their own crate's capacity, not a fixed 0 to 7.
