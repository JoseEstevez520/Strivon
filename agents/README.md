# agents/: image-only predictor (one-pass DINOv2-S, round-2 pick R3)

Reads `<camera>/<timestamp>.jpg` (or a flat folder) and writes predictions in the `annotations.json` format.
Each photo is judged on its own pixels only. One DINOv2-S pass per planogram area gives:

- the product check: a logistic head on block 8;
- the stock level: the fine-tuned head, averaged 1:1 with a free logistic stock head on the same block-8 features
  (`models/onepass/deploy/stockb8.npz`), then the best-expected-points level.

The weights were trained on every photo of `eval/labels.json` at commit 1d7b2ff (curtain photos left out). They are
224 px and stored in fp16; on all 181 photos that gives the same answers as fp32.

From the repo root:

```
python -I agents/predict.py --images <photo folder> --planogram <planogram.json> --out predictions.json
python -I agents/submission/validate.py predictions.json --images <photo folder> --planogram <planogram.json>
```

On validation day add `--expect-images 26 --expect-areas 289`.

- The last line must say `OK: <n> areas ... single image (submission mode)`. `FALLBACKS` (exit code 2) means some
  answers did not come from the model (a model failed or a photo could not be read), so do not send that file.
  `INVALID` is exit code 1.
- Works offline: the backbone is built from `deploy/dinov2_small_config.json` and every weight comes from the .pt.
- Optional: `SENSEI_DATASET=<dataset folder>` lets photos in a flat folder be matched to their camera by appearance,
  and logs (never overrides) a night-curtain look-up for cameras 6383/6386.
- Speed: about 0.8 s per photo on a laptop CPU (4 threads), 1.0 GB RAM, ~12 s start-up.
  Env vars: `ONEPASS_DEVICE=cuda`, `ONEPASS_THREADS=4`, `ONEPASS_SIZE=224`, `ONEPASS_TAG=l1d7b`, `ONEPASS_B8_HEAD=off`.
- Needs Python 3.12, torch, transformers, numpy, opencv-python and pillow.
- Not included: the challenge data (planogram, photos, labels). Pass them in with the flags above.
