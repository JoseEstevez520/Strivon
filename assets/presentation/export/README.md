# Deck exports

The web deck in `../web-deck/` turned into files other tools open. `strivon.pdf` is the one
kept here: eight pages at 1920×1080, text stays text, so Canva can import and edit it.

The rest (PowerPoint files, one picture per slide, the deck as an MP4) is too heavy for git. The scripts
in `scripts/` make it again in a couple of minutes.

| Output | Script | How it is made |
|---|---|---|
| `slide-NN.png`, 4K | `render.mjs` | Chrome opens each slide and takes a screenshot. The chat slide is cut at the moment the chart shows. |
| `strivon.pdf` | `pdf.mjs` | Chrome prints all slides, with the two clips swapped for stills. |
| `strivon-editable.pptx` | `editable.mjs`, then `finish.py` | [dom-to-pptx](https://github.com/atharva9167j/dom-to-pptx) (MIT) turns the page into text boxes and pictures. `finish.py` stops lines from wrapping, sets the page colour, puts the real clips back, and adds a fade between slides and an entrance fade for each element. |
| `strivon-pixel-perfect.pptx` | `build_image.py` | Each slide is its 4K picture, the clips on top. `build_image2.py` makes the same without clips. |
| `strivon-deck.mp4` | `rec.mjs` | Chrome records the deck while the arrow key moves through it, with the restock wave. |

## Run it

Serve the deck first (`python3 -m http.server 8123` inside `../web-deck/`). The scripts need Node with
`playwright-core` and `dom-to-pptx`, Python with `python-pptx`, `pillow` and `pypdf`, and a full ffmpeg
(`frames.sh` reads `$FFMPEG`). Run `frames.sh` first, then `render.mjs out4k 2`, then the others. Paths
inside the scripts (Chrome from the Playwright cache, `out4k/`, `frames/`) are the ones used on one machine; change them to yours.

## What does not carry over

PowerPoint and Canva cannot do the restock wave: the PPTX uses a plain wipe on the two slides that have it. The 3,399 counter shows its final number
instead of counting up. Canva drops animations from imported files, so for movement there use the MP4 or the two clips.
The animations were checked in LibreOffice and not tried in PowerPoint.
