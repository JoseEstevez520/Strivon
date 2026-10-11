# Web deck

The Strivon pitch as a web page, with no tool beyond a browser. Twelve slides, one idea each, in the look of the landing.

Open `index.html` through any static server (a plain `file://` open also works, but the clips may not autoplay):

```bash
python3 -m http.server 8000   # from this folder, then open http://localhost:8000
```

Arrow keys, space or a click move between slides. `F` goes full screen, and `#4` in the address opens slide 4.

## The story

1. The cover: the mark, the wordmark and the line, over the slot field. The restock wave leads into the next slide.
2. "Today, checking stock means walking the store. We changed that."
3. From the camera to a task list for the worker, in one slide built from parts: the photos, the 3D store with four gondolas, and the phone with the round and what to carry to each stop.
4. Generative UI: the chat clip and a line about the manager and the doubt on the shop floor.
5. The best route, from how many products are missing in each gondola and for how long.
6. What the worker sees on the phone, as a clip of the round.
7. One small model, two questions.
8. 92% of the maximum points on photos it never saw.
9. One CPU core: about 2 s a photo, 0.005 cents an image, about 60 cents a day for a store.
10. The brand ad, 18 s, with voice and music. It starts on the first press of space, which is the gesture the browser needs to allow sound. Nothing is drawn over it.
11. Try it: the logo, the address, a QR in the brand's style and the team, over the slot field.
12. The illustrated film, 11 s, with voice and captions: one photo, every crate checked, the strawberries empty, the worker with the phone. It starts on the next press of space, like the ad.

## What it shows how to do

- **Two kinds of change between slides.** The restock wave from the identity pack is kept for four turning points, marked with `data-wipe` on the slide. Everywhere else is a short fade.
- **Slides that move instead of showing a still.** On the first content slide the photos, the 3D store and the phone come in one after another, and each stop of the list follows. The score counts up. The QR is drawn as SVG, with rounded modules and red finder squares.
- **Clips cropped to what matters.** The chat, the 3D store and the phone round are cut with `clip-path` and scaled in place, so the page needs no edited copies.

The 3D store and the stops come from the model's predictions for four gondolas. The chat and the phone round are recreations with sample data, and the chat slide says so. The figures on slides 9 and 10 come from the team's forward split and from `docs/COST.md`.
