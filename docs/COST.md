# Cost per analysed image

Sensei judges 80% performance and 20% processing cost ("cheaper is always better, but it should
work"). They have not said what cost is measured in: cloud CPU price, in-store hardware or energy.
So we give all three, with the assumptions written out. The pitch uses the row of the model we submit.

## Method

- Seconds are CPU seconds per photo, end to end (crops + model + decision), taken from the
  `Seconds per photo` column of `LEADERBOARD.md` and from `lab/PREDICT.md`. We measured nothing new for this page.
- "Warm" means the model is already loaded and the process is running. "Cold" means a new process
  starts, loads the model and answers one photo. Both are given for the lab model. For the other rows
  the team reported one figure; we do not know whether it is warm or cold (see the last section).
- A photo covers 6 to 16 areas (11 on average). Divide by 11 for a cost per area.
- Store day: 14 cameras, one photo a minute, 14 hours = 11,760 photos.

## Candidates

Scores are on `labels_v1` (five folds, maximum 3858, only the photo under analysis) and on the forward
split (trained without each camera's last 2 photos, 604 maximum). "n/r" = not run on that split.
"n/m" = not measured. Cost per photo = seconds x price (see "Cloud price" below). All sources are rows
of `LEADERBOARD.md` unless noted; the row name is in brackets.

| Pipeline | Five folds / 3858 | Forward / 604 | CPU s per photo | Threads | Machine | GPU | Memory | Cost per photo (CPU) |
|---|---:|---:|---|---|---|---|---|---:|
| Lab ensemble, `predict_fast.py`, warm (`lab_image_only_ensemble`; `lab/PREDICT.md`) | 3341 | 423 | 0.106 (p95 0.159) | 1 | i7 laptop, 2 cores pinned | no | 103 MB | $0.0000027 |
| Lab ensemble, `predict_fast.py`, new process per photo (`lab/PREDICT.md`) | 3341 | 423 | 0.3 | 1 | same | no | 103 MB | $0.0000075 |
| Lab ensemble, `predict_fast.py`, batch of 28 incl. start-up (`lab/PREDICT.md`) | 3341 | 423 | 0.12 (3.4 s / 28) | 1 | same | no | 103 MB | $0.0000030 |
| Lab ensemble, `predict.py`, warm (`lab/PREDICT.md`) | 3341 | 423 | 0.144 (p95 0.211) | 1 | same | no | 513 MB | $0.0000036 |
| Lab ensemble, `predict.py`, new process per photo (`lab/PREDICT.md`) | 3341 | 423 | 4.8-5.3 | 1 | same | no | 513 MB | $0.00012-0.00013 |
| One DINOv2-small pass (`agents_img_one_pass`; forward: `agents_R0_shipped_s0/s1` 435/438, retrained `agents_R3_s0/s1` 450/441) | 3349 | 435-450 | 0.82 (R3: 0.74-0.82) | 4 | Ryzen 9 5900HS laptop | not needed; 0.06 s on RTX 3060 Laptop | n/m | $0.0000205 |
| Combined: DINOv2-small stock + lab product check (`combo_dinos_stock_lab_product`) | 3340 | n/r | about 0.9 (product part measured on a loaded machine) | n/m | n/m | not needed | n/m | $0.0000225 |
| CLIP ViT-B-32 on the crate (`single_crate`) | 3255 | 437 | 0.9-1.4 | 2-8 | laptop | no | n/m | $0.0000225-0.000035 |
| Combined: lower of CLIP crate and lab stock, CLIP product check (`combo_min_crate_lab`) | 3324 | 452 | 1.1-1.5 | n/m | laptop | no | n/m | $0.0000275-0.0000375 |
| Combined: DINOv2-small stock + CLIP product check (`combo_dinos_stock_clip_product`) | 3349 | n/r | about 1.7 | n/m | Ryzen laptop | 0.9 s of it is stock; GPU time n/m | n/m | $0.0000425 |
| Combined: fine-tuned DINOv2-base stock + CLIP product check (`combo_dinob_stock_clip_product`) | 3399 | n/r | about 6.4 (stock 5.6 + product 0.8) | 4 | Ryzen laptop | stock 0.23 s on RTX 3060 Laptop | n/m | $0.00016 |
| Fine-tuned DINOv2-base stock + frozen DINOv2-small product (`agents_img_ftB2`) | 3393 | n/r | 6.67 | 4 | Ryzen laptop | 0.26 s (from component timings) | n/m | $0.000167 |
| 9-model stock average, each photo on its own (`agents_9models_single_photo`) | 3300 | n/r | up to about 195 | n/m | laptop | 2.4 s, 2.6 GB VRAM | n/m | $0.0049 |

The Ryzen figures come from the agents' note under the leaderboard: "after a 12.5 s start-up, on the
14 newest photos", so they are warm. The laptop rows of Miguel and the combined rows do not say.

## Three bases

All three use the lab model, `predict_fast.py`, because it is the cheapest row and the one the other
rows are compared against. Change the seconds to price any other row.

### 1. Cloud price

Assumption (the one this page already used): a small CPU VM with 2 vCPUs at about $0.09 per hour
(AWS c7i.large, on demand, eu-west). That is $0.000025 per second of the whole machine. We charge the
whole machine for every CPU second, even though the lab model uses one thread. That overstates the
cost by up to two. A GPU second is priced from an NVIDIA T4 VM at about $0.53 per hour, $0.000147 per second.

| Lab model, `predict_fast.py` | Seconds | Per photo | Per 1000 photos | Per store day (11,760 photos) |
|---|---:|---:|---:|---:|
| Warm | 0.106 | $0.0000027 | $0.0027 | $0.031 |
| Batch of 28, start-up included | 0.12 | $0.0000030 | $0.0030 | $0.036 |
| New process per photo | 0.3 | $0.0000075 | $0.0075 | $0.088 |

Arithmetic: 0.106 s x $0.000025/s = $0.00000265. Times 1000 = $0.0027. Times 11,760 = $0.031.

### 2. In-store hardware

The smallest machine we can justify is a 2-vCPU machine with 2 GB of memory, the same shape as the VM above.
We have no price for buying one, so we do not give one.

- Memory: `predict_fast.py` needs 103 MB (`predict.py` 513 MB). 2 GB leaves a margin of about 19x (4x).
- Speed: 14 cameras x 1 photo a minute = 14 photos a minute = 0.233 photos a second.
  Warm: 0.233 x 0.106 s = 0.025 CPU seconds per second, 2.5% of one core, 1.2% of the machine.
  A new process per photo: 0.233 x 0.3 s = 0.07, 7% of one core.
  So the machine is idle more than 90% of the time even in the worst lab case, and a photo is
  answered well inside the minute between photos.
- For comparison, the fine-tuned DINOv2-base rows (6.4-6.7 CPU s per photo) need 0.233 x 6.7 = 1.6 cores
  on the same machine. That is 78% of two vCPUs, with no margin for a slow minute. Those rows need a GPU or a bigger machine.
  The one-pass DINOv2-small (0.82 s) needs 0.19 cores, which fits.

### 3. Energy (estimate)

Assumption: an average package power of 15 W for one laptop-class core under load. We did not measure
power. Energy = CPU seconds x 15 W.

| Lab model, `predict_fast.py` | Seconds | Joules per photo | Wh per photo | Wh per store day |
|---|---:|---:|---:|---:|
| Warm | 0.106 | 1.6 | 0.00044 | 5.2 |
| New process per photo | 0.3 | 4.5 | 0.00125 | 14.7 |

Arithmetic: 0.106 s x 15 W = 1.59 J; 1.59 J / 3600 = 0.00044 Wh; x 11,760 = 5.2 Wh. For scale, the DINOv2-base
row at 6.7 s is 100 J (0.028 Wh) per photo, 63 times more. The idle power of the machine is not counted.

## What is not measured

- Cold start of the GPU rows. The GPU seconds come from component timings and a warm run; loading
  the model onto the GPU is not in them.
- A loaded machine. The lab figures were taken with the machine under some load, so we read them as
  upper bounds, but we did not repeat them on a quiet machine. Other rows were not stated either way.
- Different machines. The lab rows ran on an i7 laptop with 2 cores pinned, the DINOv2 rows on a Ryzen
  laptop with 4 threads, the CLIP rows on another laptop with 2 to 8 threads. CPU seconds across these are not exact comparisons.
  None of them is the c7i.large we price with.
- Memory for most rows, and the power draw. Both are n/m or assumed above.
- Scores come from many looks at the same labels, so they are upper bounds. On each camera's last
  photos the lab model does worse than on the interleaved folds (+1.424 per area against +1.732).

The ratio. The cheapest row (lab, warm, 0.106 s) against the best five-fold row (6.4 s, 3399 points) is
60 times less CPU for 58 fewer points out of 3858 (1.5%), about 8 points on the 578 of the hidden
validation. On the forward split the best row is `combo_min_crate_lab` (452), which costs 1.1-1.5 s, 10 to 14 times
the lab model, for 29 more points out of 604 (4.8%). The forward split has only 302 areas, so we do not read that gap as sure.

## Pitch line

"Each photo costs about three millionths of a dollar to analyse on a plain CPU, no GPU and no API: a
whole store, every minute, all day, for about three cents, or 5 watt-hours."
(Use the row of the model we actually submit. These figures are the lab model, warm.)
