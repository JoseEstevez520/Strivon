# Web deck

An example of a presentation built as a web page, with no tool beyond a browser. It tells the Strivon story in eight slides, one idea each.

Open `index.html` through any static server (a plain `file://` open also works, but the clips may not autoplay):

```bash
python3 -m http.server 8000   # from this folder, then open http://localhost:8000
```

Arrow keys, space or a click move between slides. `F` goes full screen, and `#4` in the address opens slide 4.

## What it shows how to do

- **Two kinds of change between slides.** The restock wave from the identity pack (red cells sweep left to right, cover the slide, then empty to grey) is kept for two turning points, marked with `data-wipe` on the slide. Everywhere else is a short fade.
- **Slides that move instead of showing a still.** The photos come in one by one and lead to the 3D store, which is paused (`data-pause`) just before its camera zoom. The shelf photo gets its marks a second later. The chat plays as a clip, and the score counts up.
- **A QR in the brand's style**, drawn as SVG with rounded modules and red finder squares.

The 3D store clip uses the model's predictions. The chat clip uses sample data, as its slide says.
