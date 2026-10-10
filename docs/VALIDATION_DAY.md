# Validation day

Everything runs from `backend/` on one laptop with the data in `data/` and `eval/labels.json` up to date.

## Before (once)

```bash
python -m pip install -r requirements.txt
python -m sensei train
```

`train` builds the features (about 8 minutes the first time, cached after) and fits the supervised
model on `eval/labels.json` plus André's review. It prints the photo-held-out score and writes
`outputs/supervised.pkl`.

## On the day

1. Put the validation photos in a folder with the same layout as the data: `<folder>/<camera>/<timestamp>.jpg`.
2. Run:

```bash
python -m sensei predict --images PATH/TO/validation --context ../data/images --out ../outputs/predictions_validation.json
```

3. Check the end of the output:
   - `using supervised model (...)`: if it says label-free instead, `outputs/supervised.pkl` is missing. Run `train` first.
   - `N areas covered by a person`: areas where a shopper stands in front; those use the nearest labelled photos.
   - No `VALIDATION PROBLEMS` line. A missing area costs -5, so the command fails loudly if one is missing.
4. Submit `outputs/predictions_validation.json`.

## How good is it

| Check | Result |
|---|---|
| Label-free model (no labels) | about 177-202 / 578 |
| Supervised, 5-fold CV holding out whole photos | 489 / 578 |
| Rehearsal: 28 photos hidden, real submission command, `eval/score.py` | 485 / 608 and 497 / 608 (about 461-472 / 578) |

Rehearse again with `python rehearse.py --seed N`. It never touches the real model.

## Why the supervised model works here

The validation photos come from the same cameras on the same day, at times between ours. For each
area the model looks at how we labelled the same area in the photos just before and after, how much
the crop changed since then (CLIP embedding and colour), and the label-free signals. Most of the
points left are half vs full calls, which depend on the labelling rule (see `docs/sensei_questions.jpg`).
