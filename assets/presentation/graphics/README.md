# Presentation graphics and brand pack

Pictures for slides, the landing and social posts. Text in English; the pipeline and the problem
panels also come in Spanish (`-es`). The PNG files are what the slides use, and the SVG next to
a diagram or a chart is the same drawing as vectors (it uses Inter and falls back to a system
font where Inter is not installed). Nothing here uses the challenge's photos.

Made from `main` at `ef19e27`. The charts read their figures from `LEADERBOARD.md` at that commit,
so they are out of date when the leaderboard changes.

## Social images

| File | Size | What it is |
|---|---|---|
| `og-image.png` | 1200×630 | Link preview of the landing: logo, one-line description, a gondola with marked areas and its task chips. Also in `frontend/landing/public/` and in the landing's `<meta>` tags. |
| `github-social-preview.png` | 1280×640 | The same picture for the repository's social preview (Settings, Social preview). |

## Diagrams (`diagrams/`)

| File | What it shows |
|---|---|
| `pipeline-en`, `pipeline-es` | From a camera photo and the planogram to the two questions per shelf area, the three kinds of task and where they show up (plan, round, chat). |
| `problem-en`, `problem-es` | The three things that go wrong on a shelf: empty gondola, overstocked gondola, wrong product. Product icons from the app, no photos. |
| `score-explainer-en` | How an area is scored and the example from the brief. |

Where the numbers come from: the scoring rules and the 270 / 19 / 230 / 35 / 24 example (total 320 of
578) are copied from Sensei's challenge brief. The consequences in the problem panels are the ones
the brief lists.

## Charts (`charts/`)

| File | What it shows | Source |
|---|---|---|
| `results-top-approaches` | The ten best approaches of the leaderboard and the trivial answer, as total points out of 3,858. | `LEADERBOARD.md`, columns "Total / max" and "≈ / 578". Ranks 1 to 10 and 28. |
| `cost-vs-points` | Total points against CPU seconds per photo for the approaches with a stated number of seconds. | `LEADERBOARD.md`, columns "Total / max" and "Seconds per photo". |

Read the cost chart with care. The seconds are what each author reported, measured on different
machines and thread counts. Ranges (for example "0.9 to 1.4 s") are drawn as a bar and the point
sits at the slow end. Approaches with GPU-only times or with no number are left out, and so is the
baseline (1,554 points) so the axis can start at 3,180. The 80% performance and 20% cost split is
what Sensei wrote on the challenge Discord. The benchmark is the team's own (5 folds, 1,929
labelled areas), not the hidden validation set.

## Mockups (`mockups/`, transparent PNG)

| File | What it shows |
|---|---|
| `phone-en`, `phone-es` | The round page on a phone (390×844). |
| `laptop-en`, `laptop-es` | The first page, with the plan in 2D, on a laptop (1440×900). |
| `browser-en`, `browser-es` | The products page in a browser window (1280×800). |

Screenshots of the app at `ef19e27`, taken with Brave. The shelf states are simulated.

## Brand (`brand/`)

| File | What it is |
|---|---|
| `logo-mark.svg`, `logo-mark-{512,256,128,64}.png` | The slot grid alone, transparent. `logo-mark-dark-512.png` is the same on #1d1d1d. |
| `logo-horizontal`, `logo-vertical` (and `-dark`) | Mark with the "strivon" wordmark. The light ones are transparent. |
| `icon-192.png`, `icon-512.png`, `favicon.ico` | App icon on a rounded #f8f7f4 square; the .ico holds 16, 32 and 48 px. |
| `brand-sheet.png` | Colours, type scale, the slots and the logo on dark. |

Colours and sizes are the ones in `frontend/src/index.css`.

## Backgrounds (`backgrounds/`)

The landing's pattern of slots for slides, light, with the centre left clear: `slide-hero` (slots
around the edges) and `slide-band` (slots rising from the bottom corners), each at 1920×1080 and
1080×1920.
