# Lab model: train and predict

This is the image-only model from the lab lane. It reads one photo at a time and answers for every planogram area of the camera that took it.
Nothing else goes in: no other photos, no time of day, no file names, no CLIP.

## What it does

- Stock: a weighted average of three models. The first uses pixel features of the area and its crate, the second adds per-slot references made
  from training crops, the third is a small MobileNetV3 fine-tuned on the crops.
- Product check: the colour histogram of the area is compared with a bank of training crops of the same slot, plus a check against the product
  families of the planogram. The colours are balanced per crop first, so a change of white balance does not trigger false alarms.
- Decision: the answer with the most expected points under the challenge's scoring.

## Commands

Run from the repo root with `data/` in place (`data/planogram.json`, `data/images/<camera>/<timestamp>.jpg`).

```bash
# once: needs numpy, opencv, scikit-learn, torch and timm (the first run downloads the MobileNetV3 weights)
python lab/predict.py train --model ensemble --out lab/models/lane_i_ens.pkl

# on the photos to answer: a folder laid out as <folder>/<camera>/<timestamp>.jpg
python lab/predict_fast.py predict --images PATH/TO/photos --model lab/models/lane_i_ens.pkl --out predictions.json --threads 1
```

On validation day, add `--expect-images 26 --expect-areas 289`: if the folder holds a different number of photos or the planogram gives a different number
of areas, it prints a warning on stderr and still writes the file (add `--strict` to also exit with code 3 so a script notices). A missing area costs -5.
`--p-stock` adds `p_stock = [p_empty, p_half, p_full]` to every area, for averaging with other models; the decisions do not change.

`train` reads the answer key `eval/benchmark/labels_v1.json` and the photos in `data/images`. `predict` reads only the model file, the planogram and
the photos. It stops with exit code 2 and a message when an image cannot be read, a camera is not in the planogram, an area is missing or a value
is not a number.

The model file is not in git: it holds colour histograms of crops, which come from the challenge photos.

## Cost

There are two commands with the same arguments, the same model file and the same answers (0 different decisions on 714 areas, probabilities equal to 1e-6):
`lab/predict.py` and `lab/predict_fast.py`. The fast one runs the trees and the small CNN in numpy, so it does not import torch, timm or scikit-learn.
Use `--threads 1` (two threads use almost twice the CPU for the same time). Laptop i7, two cores pinned, no GPU, machine under some load, so read these as upper bounds:

| | `predict.py` | `predict_fast.py` |
|---|---|---|
| Starting a new process and answering one photo | 4.8 to 5.3 s | 0.3 s |
| A batch of 28 photos, whole process | 9.1 to 9.4 s | 3.4 s (0.12 s per photo) |
| CPU per photo once warm (median, p95) | 144 ms, 211 ms | 106 ms, 159 ms |
| Memory | 513 MB | 103 MB |

`train` is always done by `predict.py`; `predict_fast.py train ...` just forwards to it.

## Score

On the team benchmark (`LEADERBOARD.md`) it is the `lab_image_only_ensemble` row. Those numbers come from many looks at the same labels, so read
them as an upper bound. On the last two photos of each camera, which is where the hidden photos most likely are, it does worse than on the
interleaved folds.
