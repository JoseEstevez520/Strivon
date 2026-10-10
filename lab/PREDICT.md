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
python lab/predict.py predict --images PATH/TO/photos --model lab/models/lane_i_ens.pkl --out predictions.json --threads 1
```

`train` reads the answer key `eval/benchmark/labels_v1.json` and the photos in `data/images`. `predict` reads only the model file, the planogram and
the photos. It stops with exit code 2 and a message when an image cannot be read, a camera is not in the planogram, an area is missing or a value
is not a number.

The model file is not in git: it holds colour histograms of crops, which come from the challenge photos.

## Cost

On one thread of a laptop i7: about 0.14 s of CPU per photo once warm, and about 0.31 s per photo over a batch of 28 photos counting the 4.8 s
that python takes to start (3.7 s of it importing torch and timm). Use `--threads 1`; with two threads it uses almost twice the CPU for the same time.

## Score

On the team benchmark (`LEADERBOARD.md`) it is the `lab_image_only_ensemble` row. Those numbers come from many looks at the same labels, so read
them as an upper bound. On the last two photos of each camera, which is where the hidden photos most likely are, it does worse than on the
interleaved folds.
