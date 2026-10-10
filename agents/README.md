# Image-only predictor (agents' one-pass model)

Reads `<camera>/<timestamp>.jpg` (or a flat folder) and writes predictions in the `annotations.json` format.
Each photo is judged on its own pixels only. One DINOv2-S pass per planogram area gives both the product check and
the stock level. The weights in `models/stock_4e/deploy/` were trained on all 1929 areas of
`eval/benchmark/labels_v1.json`.

On the shared benchmark, the same recipe at 168 px scores +3354 / 3858 (about 502 / 578).

Run from the repo root:

```
python -I agents/predict.py --images <photo folder> --planogram <planogram.json> --out predictions.json
python -I agents/submission/validate.py predictions.json --images <photo folder> --planogram <planogram.json>
```

- The last line of `predict.py` must say `OK: <n> areas ... single image (submission mode)`.
  - `FALLBACKS` (exit code 2) means a model failed, so don't send that file.
  - `INVALID` is exit code 1.
- For validation day, add `--expect-images 26 --expect-areas 289` so a missing photo or area is caught.
- The night-curtain look-up (cameras 6383/6386, `SENSEI_DATASET=<dataset folder>`) only writes a log line. The model
  answers those photos by itself.
- Speed: about 0.4–0.95 s per photo on a laptop CPU (4 threads), 0.06 s on a laptop GPU, 0.9 GB RAM, 15–25 s start-up.
  - Env vars: `ONEPASS_DEVICE=cuda`, `ONEPASS_THREADS=4`, `ONEPASS_SIZE=168`.
- Needs Python 3.12, torch, transformers, numpy, opencv-python and pillow. The first run downloads
  `facebook/dinov2-small` from Hugging Face.
- Not included: the challenge data (planogram, photos, labels). Pass them in with the flags above.
