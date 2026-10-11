# R3 without `transformers`, and what int8 costs

Measured by a lab agent on an i7-14650HX, one thread, CPU quota on, in a separate venv (transformers 4.57.6). Nothing under `agents/` was edited.

What is safe, and validated:
- `dinov2_lite.py` is a copy of the DINOv2-small backbone that uses the same modules and operations as `transformers`' `Dinov2Model` and does not import `transformers`.
  `onepass_infer.diff` is the small change in `agents/models/stock_4e/onepass_infer.py` that uses it (apply by hand: copy `dinov2_lite.py` next to it first).
- On the 28 forward photos (304 areas) and 40 other photos (410 areas): 0 different decisions, the output JSON identical byte for byte. Start-up 1.8 to 2.9 s -> 0.7 s,
  peak memory 790 MB -> 447 MB, CPU per photo unchanged (1.02 -> 1.04 s). It also removes the `transformers` 5.x silent-fallback trap.

What does not make a photo faster without changing answers: `inference_mode`, ONNX Runtime fp32 (sdpa, eager, fused). The DINOv2 forward is 99% of the time per photo.

Dynamic int8 (forward split, `python eval/benchmark.py forward`, trained weights `ld6ee` that saw these photos, so the original is favoured):

| | CPU per photo | batch of 28 | unchanged areas (269 of 538) | decisions changed (all worse) |
|---|---|---|---|---|
| original R3 | 1.02 s | 34.7 s | 530 | - |
| int8 per tensor | 0.56 s (-48%) | 18.2 s | 523 (-7) | 2 stock |
| int8 per channel | 0.59 s (-44%) | 19.3 s | 524 (-6) | 1 stock + 1 product |
| int8 MLP only | 0.82 s (-25%) | 26.1 s | 521 (-9) | 3 |

So int8 buys about half of the CPU for about 1.2% of the points on the forward split. Whether that is a good trade depends on how Sensei scores cost; the lab does not recommend it without that answer.
The other `.py` files here are the scripts used (they expect a scratch venv and copies of `agents/`; read them as notes, not as tools).
