# 3D store clips

Captured from the real 3D view of the app (the first page, 3D button), frame by frame with a
headless browser, so the camera moves are smooth and the clips play the same every time. Nothing
here is drawn by hand. The day bar is not played: the store is shown at 20:16, with the problems of
the day marked.

| File | Size | Length | What it shows |
|---|---|---|---|
| `store-3d.mp4` | 1920×1080, 30 fps, 4.5 MB | 20 s | The store from the front, a slow turn to the corner view, a fly-in to Gondola 6 (the first stop of the round) where it is picked and its card lists what is empty, wrong or half full, then back out |
| `store-3d-loop.mp4` | 1920×1080, 30 fps, 3.1 MB | 7 s | A slow turn over the whole store that ends where it starts, for a background or a looping slide |
| `store-3d.gif` | 720×405, 10 fps, 3.4 MB | 7 s | The same loop as a light GIF |
| `store-3d-poster.png` | 1920×1080, 0.7 MB | still | The store from the corner view, for a slide or a video poster |

The shelf states are the model's answers (`outputs/predictions.json`, written by `agents/predict.py`) for the last photo of each camera. The products and layout come from the challenge's planogram.
