# Which model do we submit? A one-page brief for the 07:45 decision

Written at 04:30 on 11 Oct from the numbers in `LEADERBOARD.md`, `docs/COST.md`, `docs/BOARD.md` and the lab log. The freeze is at 10:30.

## The options

| | Points on the forward split, 269 areas nobody relabelled (max 538) | Same split, current labels (max 604) | CPU per photo | Notes |
|---|---:|---:|---|---|
| A. André's R3 alone (`agents/predict.py`, `ld6ee`) | 494 (seed 0), 483 (seed 1) | 539 / 524 | about 1.0 s on a Linux i7, 2.0 s on Miguel's laptop | The current choice. Trained on every labelled photo. |
| B. Lab ensemble (`lab/predict_fast.py`) | 456 | 489 | 0.11 s warm, 0.3 s to start and answer one photo | The cheap backup. 103 MB, no GPU. |
| C. Average of A and B (`combine`, equal weights) | -7 to -25 against A alone on the unchanged areas | | about 1.1 s | Not worth it: more cost, no more points. |

A is ahead of B by about 6% of the points on the unchanged areas (38 of 538), with an error of about 15. Under the labels that follow Sensei's wording the gap shrinks to about 2%.
Many of the "current labels" differences come from a review that started from model disagreements: 30 of the 33 corrected forward labels agree with R3's own answers. Use the unchanged areas to compare.

## The grade is 80% points and 20% cost, and nobody has said how cost is scored

For the lab to win, its cost advantage (scored from 0 to 1) must exceed 4 times the difference in points (as a share of the maximum). With R3 at 2.0 s and the lab at 0.11 s:

| How cost could be scored | Cost advantage of B | B wins if the labels are like the team's (needs more than about 0.28) | B wins if the labels follow Sensei's wording (needs more than about 0.08) |
|---|---:|---|---|
| Linear, 10 s budget | 0.19 | no | yes |
| Logarithmic | 0.42 | yes | yes |
| Relative to the cheapest team | 0.94 | yes | yes |
| Threshold (1 s = 1, up to 2.5 s = 0.7) | 0.30 | yes, barely | yes |

If R3 is measured on the same machine as the lab (about 1.0 s) the advantage halves and several rows tie. A wins only with an absolute budget and team-like labels.

## Rule of thumb

- If Sensei says cost is a threshold or an absolute budget that R3 already meets: submit A.
- If it is relative to the cheapest team, logarithmic, or if we cannot find out: B maximises the expected grade in 7 of the 8 cases above; A maximises the points.
- One sentence to ask Sensei: "Is the cost scored as an absolute value with a threshold (for example CPU seconds per photo) or relative to the cheapest team, and on which hardware?"

## Before the freeze (10:30)

1. Rehearse the exact command of the chosen model from a clean checkout of `main` (`docs/VALIDATION_DAY.md`): 26 photos, 289 areas, validator with 0 errors. Use `--expect-images 26 --expect-areas 289`.
2. For A: a venv with `transformers` below 5 (otherwise it silently falls back on every area and still writes a normal-looking file), one thread, `SENSEI_DATASET` set. The lab has a copy of the backbone that does not need `transformers` and gives the same answers (`lab/r3fast/`); adopting it is André's call.
3. For B: copy `lab/models/lane_i_ens.pkl` from the laptop that trained it (it is not in git) or rebuild it with `lab/predict.py train`; rebuilding on another laptop has not been rehearsed.
4. Labels: a person has now read 40 of the disputed forward areas with Sensei's rule, twice, the second time blind. They agree with the team on 22 of 40 and with the Sensei-wording passes on 18. Of the 32 areas the team called `full`, 15 stay `full` and 17 become `half`; 6 of the 7 team `empty` stay `empty` (the passes said `half`). On those 40, lab scores -24 and R3 -31 / -28 against that reading (team labels: +26 and +40 / +36). The set was picked because the sources disagreed, so it is not a rate for all areas, and it is one reader: it supports keeping the lower level when unsure, not changing the model. Details in `lab/EXPERIMENT_LOG.md`. The few labels listed on `docs/BOARD.md` are still worth a look.

## What is not known

How Sensei's annotators label; how cost is scored; whether the hidden photos are between ours or after the last one of each camera (the brief says all images come from one day). All our numbers come from many looks at the same labels: read them as upper bounds, and differences under about 25 points of 604 as noise.
