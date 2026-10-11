# Cost per analysed image

Sensei judges 80% performance and 20% processing cost ("cheaper is always better, but it should
work"). They have not said what cost is measured in: cloud CPU price, in-store hardware or energy.
So we give all three, with the assumptions written out. The pitch uses the row of the model we submit.

## Method

- Seconds are CPU seconds per photo, end to end (crops + model + decision), taken from the
  `Seconds per photo` column of `LEADERBOARD.md` and from `lab/PREDICT.md`. The one exception is the
  submission, measured end to end below.
- "Warm" means the model is already loaded and the process is running. "Cold" means a new process
  starts, loads the model and answers one photo. Both are given for the lab model. For the other rows
  the team reported one figure; we do not know whether it is warm or cold (see the last section).
- A photo covers 6 to 16 areas (11 on average). Divide by 11 for a cost per area.
- Store day: 14 cameras, one photo a minute, 14 hours = 11,760 photos.

## Candidates

Scores are on `labels_v1` (five folds, maximum 3858, only the photo under analysis) and on the forward
split (trained without each camera's last 2 photos, 604 maximum, also on `labels_v1`). "n/r" = not run on that split.
"n/m" = not measured. Cost per photo = seconds x price (see "Cloud price" below). All sources are rows
of `LEADERBOARD.md` unless noted; the row name is in brackets.

| Pipeline | Five folds / 3858 | Forward / 604 | CPU s per photo | Threads | Machine | GPU | Memory | Cost per photo (CPU) |
|---|---:|---:|---|---|---|---|---|---:|
| **The submission**: one DINOv2-small pass, R3 weights `ld6ee`, `agents/predict.py`, batch of 28 incl. start-up, measured end to end (see below) | n/r | 450 / 441 (`agents_R3_s0/s1`) | 2.0 | 1 | Core Ultra 7 155H laptop | not needed | about 1.0 GB (`agents/README.md`) | $0.000050 |
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

The forward column is on `labels_v1`, where 33 of the 302 forward labels were corrected later. On the
269 forward areas whose labels nobody changed, the order is: the submission +494 / 538 (seed 1: +483),
`combo_min_crate_lab` +458, lab ensemble +453, CLIP crate +447 (`LEADERBOARD.md`, forward table).

## The submission, measured end to end

`agents/predict.py` on a copy of the 28 forward-split photos (304 areas), Miguel's laptop (Intel Core
Ultra 7 155H, Windows, Python 3.14, torch 2.14 CPU), 11 Oct around 02:00, nothing else running. CPU =
the process's own user + kernel time from start to exit (`GetProcessTimes`), so it counts every thread
and the start-up.

| `ONEPASS_THREADS` | Weights | Start-up | Wall per photo | CPU per photo | Cost per photo (CPU) |
|---:|---|---:|---:|---:|---:|
| **1 (what we run)** | `ld6ee` (the final ones) | 6.6 s | 2.1 s | **2.0 s** | **$0.000050** |
| 1 | `l1d7b` (the previous ones) | 6.1 s | 2.1 s | 1.9 s | $0.000048 |
| 2 | `l1d7b` | 7.0 s | 1.6 s | 2.7 s | $0.000066 |
| 4 (the predictor's default) | `l1d7b` | 7.6 s | 1.4 s | 4.5 s | $0.00011 |

- The answers are identical at 1, 2 and 4 threads (0 of 304 areas differ), so we run one thread: 2.3
  times less CPU than the default for 0.7 s more wall time per photo.
- Warm, one thread spends 1.6-1.7 s per photo; the start-up adds about 0.2 s per photo over a batch of 26-28.
- These are higher than the earlier 0.48 s (wall, 8 photos, the same laptop) and 0.74-0.82 s (wall, 4
  threads, Ryzen laptop) because they are CPU seconds of all threads with the start-up included.
- On a GPU: 0.06-0.08 s per photo (RTX 3060 Laptop), not needed.

## Three bases

Each base gives the submission first, then the lab model, `predict_fast.py`, because it is the cheapest
row and the one the other rows are compared against. Change the seconds to price any other row.

### 1. Cloud price

Assumption (the one this page already used): a small CPU VM with 2 vCPUs at about $0.09 per hour
(AWS c7i.large, on demand, eu-west). That is $0.000025 per second of the whole machine. We charge the
whole machine for every CPU second, even though the lab model uses one thread. That overstates the
cost by up to two. A GPU second is priced from an NVIDIA T4 VM at about $0.53 per hour, $0.000147 per second.

| Model | Seconds | Per photo | Per 1000 photos | Per store day (11,760 photos) |
|---|---:|---:|---:|---:|
| **The submission, 1 thread, batch of 28, start-up included** | 2.0 | $0.000050 | $0.050 | $0.59 |
| Lab model, `predict_fast.py`, warm | 0.106 | $0.0000027 | $0.0027 | $0.031 |
| Lab model, batch of 28, start-up included | 0.12 | $0.0000030 | $0.0030 | $0.036 |
| Lab model, new process per photo | 0.3 | $0.0000075 | $0.0075 | $0.088 |

Arithmetic: 2.0 s x $0.000025/s = $0.000050. Times 1000 = $0.050. Times 11,760 = $0.59. For the lab:
0.106 s x $0.000025/s = $0.00000265. Times 1000 = $0.0027. Times 11,760 = $0.031. The submission uses one
thread, so with two photos at a time on the 2-vCPU machine its price halves to $0.000025 per photo.

### 2. In-store hardware

The smallest machine we can justify is a 2-vCPU machine with 2 GB of memory, the same shape as the VM above.
We have no price for buying one, so we do not give one.

- The submission: about 1.0 GB of memory, so 2 GB leaves a margin of 2x. Speed: 0.233 photos a second
  (below) x 2.0 s = 0.47 CPU seconds per second, 47% of one core, 23% of the machine, and each photo is
  answered in about 2 s.
- Memory: `predict_fast.py` needs 103 MB (`predict.py` 513 MB). 2 GB leaves a margin of about 19x (4x).
- Speed: 14 cameras x 1 photo a minute = 14 photos a minute = 0.233 photos a second.
  Warm: 0.233 x 0.106 s = 0.025 CPU seconds per second, 2.5% of one core, 1.2% of the machine.
  A new process per photo: 0.233 x 0.3 s = 0.07, 7% of one core.
  So the machine is idle more than 90% of the time even in the worst lab case, and a photo is
  answered well inside the minute between photos.
- For comparison, the fine-tuned DINOv2-base rows (6.4-6.7 CPU s per photo) need 0.233 x 6.7 = 1.6 cores
  on the same machine. That is 78% of two vCPUs, with no margin for a slow minute. Those rows need a GPU or a bigger machine.
  The one-pass DINOv2-small (the submission, 2.0 CPU s end to end) needs 0.47 cores, which fits.

### 3. Energy (estimate)

Assumption: an average package power of 15 W for one laptop-class core under load. We did not measure
power. Energy = CPU seconds x 15 W.

| Model | Seconds | Joules per photo | Wh per photo | Wh per store day |
|---|---:|---:|---:|---:|
| **The submission, 1 thread, start-up included** | 2.0 | 30 | 0.0083 | 98 |
| Lab model, `predict_fast.py`, warm | 0.106 | 1.6 | 0.00044 | 5.2 |
| Lab model, new process per photo | 0.3 | 4.5 | 0.00125 | 14.7 |

Arithmetic: 2.0 s x 15 W = 30 J; 30 J / 3600 = 0.0083 Wh; x 11,760 = 98 Wh. 0.106 s x 15 W = 1.59 J; 1.59 J / 3600 = 0.00044 Wh; x 11,760 = 5.2 Wh. For scale, the DINOv2-base
row at 6.7 s is 100 J (0.028 Wh) per photo, 63 times more. The idle power of the machine is not counted.

## What is not measured

- Cold start of the GPU rows. The GPU seconds come from component timings and a warm run; loading
  the model onto the GPU is not in them.
- A loaded machine. The lab figures were taken with the machine under some load, so we read them as
  upper bounds, but we did not repeat them on a quiet machine. Other rows were not stated either way,
  except the submission's, measured on a quiet machine (under load the same run took 4 times longer).
- Different machines. The lab rows ran on an i7 laptop with 2 cores pinned, the DINOv2 rows on a Ryzen
  laptop with 4 threads, the CLIP rows on another laptop with 2 to 8 threads. CPU seconds across these are not exact comparisons.
  None of them is the c7i.large we price with.
- Memory for most rows, and the power draw. Both are n/m or assumed above.
- Scores come from many looks at the same labels, so they are upper bounds. On each camera's last
  photos the lab model does worse than on the interleaved folds (+1.424 per area against +1.732).

The ratio. The cheapest row (lab, warm, 0.106 s) against the best five-fold row (6.4 s, 3399 points) is
60 times less CPU for 58 fewer points out of 3858 (1.5%), about 8 points on the 578 of the hidden
validation. On the forward split, on the 269 areas whose labels nobody changed, the best row is the
submission (+494 / 538, seed 1 +483), which costs about 17 times the lab model's CPU (2.0 s against 0.12 s,
start-up included) for 41 more points out of 538 (7.6%), about 44 on the 578 of the hidden validation.
On `labels_v1` the top forward rows are within 2 points of each other (450-452), because 33 of its forward
labels were corrected later. With 269-302 areas, gaps under about 10 points are noise.

## Pitch line

"Each photo costs about five thousandths of a cent to analyse, on one CPU core, with no GPU and no API:
a whole store, every minute, all day, for about 60 cents, or 100 watt-hours."
(The submission's row, charging the whole 2-vCPU machine for every CPU second, so an upper bound.)
