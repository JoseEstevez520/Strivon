# Experiment log

Facts and numbers only. Dates are Saturday 10/10/2026, Lisbon time. Every claim points at a line of `results*.jsonl` or a file in `silver/`.

## Starting point

Human labels from four people (1258 on the first 8 photos of each camera, 73% full, 19% half, 8% empty). The team model (CLIP zero-shot + bare-container fraction + expected-points decision) scored
659 of 1950 on 975 labelled areas; its stock points (-217) matched the trivial policy "always full" (-201). A logistic regression on its own outputs (`exp_000`) finds 1 of 241 `half` areas.

## Round 1 (leave-one-camera-out, human labels)

Gain over "always full" (-0.129 points per area), 95% interval over cameras in brackets.

| Run | What it does | Gain | `half` found |
|---|---|---|---|
| exp_000 baseline | logistic regression on the pipeline outputs | +0.075 [-0.13, +0.28] | 1/241 |
| a06 / a04 | pixel background and gap features on the planogram polygon | +0.400 / +0.385 [+0.16, +0.62] | 100/241 |
| b01 | area-day temporal features | +0.297 [+0.06, +0.54] | 72/241 |
| c04 | DINOv2-small embeddings, 112 px | +0.297 [+0.10, +0.50] | 67/241 |
| d03 | camera centering | +0.124 [-0.08, +0.34] | 40/241 |
| e02 / e04 | own crate boxes + polygon features (+ temporal) | +0.500 / +0.510 [+0.31, +0.72] | 137/241 |

What was learnt: pixel signals find `half`; the pipeline's CLIP outputs cannot. Measuring the whole crate beats measuring the drawn polygon (the geometry, not more features, gave the gain).
Hand-set HMM smoothing hurt (-0.33): `half` labels flicker and the chain erased the 72% `full`. Class-prior flattening hurt (-0.11). Adding the hour made the late photos collapse (-1.33): the model learned "morning means full". DINOv2 costs about 1 s per image against 0.06 s for the pixel features.
Compliance: "always compliant" is the right default; a step-change rule nets +0.045 per area in the human world and +0.008 in the LLM world, fragile.

## Labelling with LLMs (all 181 photos, 14 cameras)

Two independent passes with one frozen rubric (`RUBRIC.md`) and the whole-crate view: Sonnet (photos in order) and Opus (reverse order); neither saw the human labels or the other pass.
- Sonnet vs Opus: 68% exact, kappa 0.44, every disagreement is one level. Opus is stricter: 26% full against 40%.
- Against the humans (1243 areas): Sonnet 63%, Opus 46%. Humans label 73% full, Sonnet 43%, Opus 22%.
- Where both LLMs agree with each other, they differ from the humans in 44% of areas, almost all human `full` against LLM `half`, repeated across all 8 photos of the same area (crates that look the same all day).
- Compliance: 95% agreement; 36 areas flagged by both, humans flagged 68.

Consequence: the disagreement is about where `full` ends (completely full against the usual display level), not about perception. A model trained on one world loses to "always half" in the other.

## Round 2 (leave-one-camera-out, four label worlds)

Headline: gain over the best constant policy in the worst world. Round-1 model e02: H +0.50, S1 -0.157, S2 -1.075, C -0.686.
- t04 (stack of e02 with neighbour photos and carry-forward, also trained on consensus labels of the other cameras): worst -0.784, mean -0.144, H +0.431. Late photos improve from about -1.2 to between -0.25 and -0.47 in the LLM worlds.
- r (mixtures of world models): no mixture reaches worst_gain above 0; H and S2 ask for opposite decisions on the same features. Pooled model with the world as a feature, marginalised at 50/50: H +0.218, S1 +0.320, S2 -0.758.
- w (label-free background-subtraction coverage, 46 ms per image): it does not transfer between worlds; the gain of mixing comes from the mixture, not from the coverage.
- k (compliance): see above.
- u (embeddings on the crates, DINOv2-small and MobileNetV3-small at 112 px): embeddings add over crate pixels in every world. Human-labels-only: u01 H +0.585, worst -0.970. One model per world, probabilities averaged: u03 worst -0.238, mean +0.068, H -0.137 (control without embeddings, w05: -0.409 / -0.027 / -0.094). MobileNetV3 gives almost the same as DINOv2 (u04 worst -0.260) at about 18-27 ms per image against 585-1049 ms: DINOv2 does not pay for its cost. No setting reaches worst_gain high with H >= +0.30; S2 sets the worst world.
Pending at the time of writing: crates v2 (s), polygon pixels v2 (p), cheap embeddings on crates (u), small CPU vision-language model (v).

## Train/test judge (run3, frozen test of 28 photos, 304 areas, human labels on 142 of them)

Gain over the best constant policy: exp_000 H -0.03; d03 H +0.18; a04 H +0.37; e02 H +0.59. In the strict worlds every model still loses to "always half" (worst between -1.0 and -1.5).

## Labelling with Sensei's own wording (rubric v2, `RUBRIC_V2.md`, `silver2/`)

Sensei's message (see `docs/SENSEI_INFO.md`): would someone buy the remaining products (if not, empty); would staff take the time to replenish (if so, half; if not, full); in doubt choose the lower level. Two independent passes: p3 Sonnet, p4 Opus (reverse order); neither saw the human labels or the other pass. Results on the 13 cameras complete at the time of writing (`silver2_report.py`):

| | Exact agreement with humans | `full` share |
|---|---|---|
| v1 (strict, our wording) Sonnet / Opus | 65% / 47% | 46% / 24% |
| v2 (Sensei's wording) Sonnet / Opus | 81% (kappa 0.58) / 77% (kappa 0.53) | 69% / 59% |
| humans | | 72% |

- The two v2 passes agree with each other on 75% of areas (kappa 0.51); v1 gave 68%. Where both v2 passes agree and a human label exists, the humans differ in 11% (95 of 829); with v1 it was 44%.
- Compliance: 96% agreement, 24 areas flagged by both.
- Reading: with Sensei's own wording the labels are close to the human world H; the strict rubric (our wording, "completely full") is what pushed the LLM labellers away from the humans. H becomes the reference world, v2 its confirmation; models that bought robustness in the strict worlds at the price of H (u03, r06, p05) lose their reason to exist.
- Open on rubric v2: pass 3 for cameras 6462 and 6468 was still running. Labellers asked: is the stock level of a drawer holding another product measured on what is there or on what is expected? How many loose pieces make a shopper buy (3 melons in a big crate)? Both are undefined in Sensei's text.
- Process note: agents working in the shared `/tmp` overwrote each other's helper scripts three times; labels were checked and were not affected.

## Gate A: v2 worlds in the judge, re-score, leakage audit (Saturday 10/10, evening)

Change to the judge (metrics only, commit 4bc6069): worlds N1 (p3 Sonnet v2), N2 (p4 Opus v2), CN (agreement), HN (humans, else CN) in `run2.py` and `run3.py`; new fields `worst_v2` and `mean_v2` over H, N1, N2, CN. `worst_gain` and `mean_gain` keep their old meaning.

Frozen test (`run3.py`, 28 photos, 304 areas), gain over the best constant policy of each world:

| Run | H | N1 | N2 | CN | worst_v2 | worst (strict) |
|---|---|---|---|---|---|---|
| e02 | +0.585 | +0.441 | +0.441 | +0.419 | +0.419 | -1.000 |
| u01 | +0.514 | +0.424 | +0.438 | +0.389 | +0.389 | -0.947 |
| e04 | +0.486 | +0.395 | +0.441 | +0.385 | +0.385 | -1.010 |
| t03 | +0.415 | +0.280 | +0.303 | +0.239 | +0.239 | -1.023 |
| a04 | +0.366 | +0.227 | +0.362 | +0.256 | +0.227 | -1.168 |
| t04 | +0.387 | -0.257 | -0.375 | -0.637 | -0.637 | -0.641 |

Reading: the order in H and in the v2 worlds is the same, so v2 confirms H. t04 bought robustness in the strict worlds by training on their consensus and loses in every v2 world.

Leakage audit (e02, u01, e04; one auditor each): all three clean. Shuffling the test labels leaves the predictions unchanged (e02 max difference 0.0; u01 identical prediction hash). Caveats:
- e02 was picked among e01-e05 in `run.py` before the frozen test existed, on labels that include the test photos; its edge over the siblings is 0.01-0.04, so the optimism on H is estimated below 0.05.
- About 50 looks at the same labels in run2/run3 (81 lines over all result files): numbers are a ceiling. 142 H-labelled test areas: differences of 0.1 in H are noise.
- u01: the 16-dim PCA and the per-crate day statistics are fitted on all 181 photos, test included, without labels (allowed, now declared here).
- Open leak risk, not in the finalists: `exp_u_lib.py` takes `held = test_rows[0]["cam"]`; under `run3` the silver labels of test photos of the other 13 cameras would enter training in the mix variants (u03-u06). Also check whether t04 (trained on consensus labels) has the same pattern; its run3 numbers are not trusted until checked. Both are dropped branches, so this is not urgent.
- Not verified: the code that produced `p_stock` in the CLIP pipeline (`calibrated: False` in `state.json`).

Decision: e02 is the base model, because it has the best H and worst_v2 and is the cheapest of the three.
Decision: u01 is kept only as a reference for what embeddings add; DINOv2 costs about 1 s per image against 60 ms for e02, and gains nothing over it in any v2 world.
Decision: drop t04, u03-u06, r06, p05 and the other strict-world models, because the strict worlds no longer set the target.
Decision: drop e04 and t03 as stand-alone finalists, because temporal features did not beat e02 on the frozen test (H +0.486 vs +0.585).
Next: round 3 on top of e02 and trained on HN and N-world labels (more labelled areas, covering late photos), a cheap embedding branch (MobileNetV3 on crates, 18-27 ms), a late-photo branch, a cost branch, and a permutation-style sanity branch. Per-world training is judged on `worst_v2` with H >= +0.30.

## Round 3 and the switch to the team exam (Saturday 10/10, night)

Decision: the exam is the team benchmark (`LEADERBOARD.md`, `eval/benchmark.py`, merged to main at 50d13df), not the lab's worlds, because the hidden validation is scored with identification + stock on human-style labels and the team now labels all 181 photos. New judge `run5.py` (five photo folds, key labels_v1, ident + stock, last photo reported apart); `run4.py` copies the team's own rehearsal (2 hidden photos per camera, same draw as `backend/rehearse.py`). Judge files changed only to add judges.
Decision: stop n04 (cost), n05 (occlusion) and n06 (calibration) mid-round, because 12 parallel runs put the load at 140 on 24 cores and no timing or run was reliable. Their question marks stay open: cost must be re-measured on an idle machine; the occlusion signal was not tested.

Round 3 results (run2, leave one camera out; reference e02 H +0.500, worst_v2 +0.304):
- n01 neighbour labels (own photo-held-out dev check): +0.08 to +0.10 over plain e02 with a different labeller for the neighbours; more when the same labeller labels neighbours and truth (inflated). Late photos improve from +0.47 to +0.65-0.70.
- n02 (train on v2 labels too): best n02d H +0.533, worst_v2 +0.344; late photos unchanged. Voting on both passes (n02b) loses everywhere. Now moot: the team labels cover all photos.
- n03 (MobileNetV3 embeddings + HN): H +0.533, worst_v2 +0.422; the gain comes from HN training, not from the embedding. Within the noise of choosing among ~6 variants.

Team exam, e02 vs n01 (always-compliant identification):
- `run4` (5 draws, 2 hidden photos per camera): e02 2097/3040, n01 2340/3040 (stock gain over the best constant +0.616 vs +0.776). Team rehearsal reports 485 and 497 of 608 for its own model; not reproduced here (seed 1 run still unfinished), seeds unknown.
- `run5` (benchmark): baseline +1554/3858; e02 +2603 (+1.349 per area, last photo +0.987); n01 +3029 (+1.570, last +1.430). Ident +1653 for both (92 of 1929 areas are non-compliant; perfect compliance adds at most +276).
Caveats: n01 uses the team's labels of neighbouring photos and the key is the team's labelling, so the same-labeller effect inflates its gain (+0.16 here against +0.10 with a different labeller). The backend of the team uses the hour of the day as a feature (`ts % 86400`, `supervised.py:182`); not our rule, flagged to them.
Round 4 (running): c01 compliance with neighbour labels, s01 richer neighbours for stock, s02 error analysis, calibration and permutation control. Development on folds 0-2 only; folds 3-4 stay with the orchestrator for finalists.

## Round 4-5: the team benchmark, rules, cost and the lane decision (Saturday 10/10, night)

Context: the team benchmark (`LEADERBOARD.md`, `run5.py`) is the exam. Sensei's literal words: the timestamp is given, the model should learn from the image itself and not necessarily the time of day. A teammate's doc quoted "only the image under analysis"; that is his interpretation, not a message from Sensei. We never use the hour of the day.

Results (5 folds, 3858 points max, identification + stock):
| Model | Lane | Total | Ident | Stock | Last photo per area |
|---|---|---|---|---|---|
| baseline "right product, full" | | 1554 | 1653 | -99 | 0.344 |
| e02 | image | 2603 | 1653 | 950 | 0.987 |
| i01d (e02 + trees) | image | 2922 | 1653 | 1269 | 1.285 |
| x01 blend (no CLIP columns) | image | 2871 | 1653 | 1218 | 1.126 |
| x01 blend + p01 HSV compliance | image | 3099 | 1881 | 1218 | 1.146 |
| n01 + c01 | neighbours | 3275 | 1899 | 1376 | 1.450 |
| d01 + c01 | neighbours | 3264 | 1899 | 1365 | 1.298 |
| x01 blend + c01 gated 6 h | hybrid | 3117 | 1899 | 1218 | 1.146 |

Findings:
- Stress test (g01): n01 stock gain disappears when neighbours are far or only earlier (+842 with all, +182 with 2 h away and earlier only, e02 +580). d01, trained with dropped neighbours, holds +736.
- Cost audit: e02's first block (4 columns) came from CLIP ViT-B/16 in `state.json`, so the ~60 ms figure was wrong. Ablation without those columns: e02 -24 points, e02 + trees -51. Decision: drop CLIP from our model.
- Product check from the image alone (p01): a bank of training crops per planogram slot plus HSV distance, 45 of 54 non-compliant areas found with 0 false alarms in folds 0-2, 8 ms per photo. It finds changes that recur in the training folds, not new ones (the 2 new ones were missed). DINOv2-S gives +12 more points at 35 times the cost: not used.
- Tree head (i01): the gain of i01c over e02 comes from the trees, not from the fill-level features (+42, interval includes 0).
- Time-block holdout (b01, `run6.py`; photos come every 60-78 min with no gaps, so the 26 hidden photos are probably after our last photo or from another day): image-only stock ties with the neighbour models; only compliance persistence survives. A +24 h timestamp shift showed that d01 and c01 do not fall back to no-neighbour mode without a gate.
- Image-only (x01 blend + p01 HSV) in run6: (a) 386 of 604, (b) 480; the hybrid with neighbours: 386 and 489. Ties.
- Calibration, ordinal heads, richer neighbours (s01, s02): no gain beyond noise; the decision rule already maximises expected points.
Decision: the primary submission is the image-only model (x01 blend + p01 HSV), because it ties the neighbour models in every test, needs no labels of other photos at inference and is cheap. The neighbour lane stays documented, not submitted unless something changes.
Caveats: more than 60 looks at the same labels, so every number is an upper bound; teammates' rows (Miguel 3205, André 3190) are their own files and were not reproduced here; cost per photo of the final model is not yet measured cold with 2 threads.
Next: leakage audit of the final model, cold cost measurement, a reproducible `predict`, one pass on the fresh draw, leaderboard row.

## Round 6 and the lane decision (Saturday 10/10, late night)

Final image-only candidate: weighted average of three stock models (h01d pixel features with fill-profile block, r01b per-slot references, a small fine-tuned MobileNetV3 stacked from out-of-fold logits; weights from inner grouped CV on the training folds) + p01 HSV bank + planogram-family product check. Team benchmark: 3350 of 3858 (ident 1902, stock 1448, last photo 1.404 per area); row merged to main (PR #27). No CLIP, no GPU, no labels of other photos, no time of day.

| Step | Five folds | Time block (a) / (b), 604 max | Decision |
|---|---|---|---|
| x01 no-CLIP blend + p01 | 3099 | 386 / 480 | base |
| r01 slot references | 3248 | 417 / 447 | tie in blocks (data-starved in b) |
| h01d fill-profile features, one head | 3306 | 409 / 452 | adopted for stock |
| f01 fine-tuned MobileNetV3 stack | stock 1370 | n/a | member of the ensemble |
| e01 weighted ensemble h01d + r01b + CNN | 3350 | 423 / 474 | adopted: gains in all three tests (+44, +14, +22) |

Closed without gain, with the reason:
- a01 augmentation, label smoothing, test-time augmentation: spread between jitter seeds (about 18 points) larger than any gain; TTA costs +210 ms.
- h02 and b02 (half vs full, two rounds on the same residual): 36 half-predicted-as-full errors identical across variants. An image review (q01) found 16 clearly half, 11 arguable, 9 probably full (label noise); the visible cue is the container floor (pulp trays, wicker, liner), but a per-slot floor model overfits because crates are shared and neighbouring training photos are near-identical.
- v01: product changes never seen in training are found by a planogram-family check (39 of 54 with 1 false alarm in a leave-slot-out test), cheap with HSV (about 1 ms); the bank-only check finds none. Kept as insurance, no gain in the blocks.
- Calibration, ordinal heads (s02), richer neighbours (s01): no gain.
Team mix: the cheaper combined row (André's DINOv2-small stock + the lab's product check) scores 3340 against 3346 with the CLIP product check, and cuts about 0.8 s of CPU per photo (PR #25).
Stopping rule used: a change goes in only with +40 points on the five folds, no loss on the last photo and cost under 1 s.
Honest caveats: more than 90 looks at the same labels, so every number is an upper bound; differences under about 170 points on the 3858 scale are inside the noise; time-block holdouts have 28 photos and one draw; cost per photo is still being measured cold on an idle machine.
Next: port `predict` to the ensemble (running), cold cost on an idle machine, update the row, freeze at 10:30.

## Robustness to light and the product check (Sunday 11/10, just after midnight)

rb01 changed only the photo being scored (folds 0-2, training untouched) and measured the loss in points against the unmodified reference (stock +741, ident +1131): brightness x0.8 -182 stock, x1.2 -78; contrast x0.8 -477 stock and -69 ident; warm and cold white balance -144 and -172 stock but -246 and -303 ident (the product check raises its non-compliant flags from 63 to 135-154); blur sigma 0.8 -152, sigma 1.5 -1175 (the model calls almost everything empty or half; the Laplacian variance and edge density are the sensitive features); JPEG quality 60 -22.
Gray-world per crop for the whole model keeps brightness and white balance within -56 but costs 50 points of stock on the reference and fixes neither contrast nor blur: not adopted.
Gray-world only inside the product check (`exp_rb01_wbcomp.py`, 2.4 ms per photo): reference ident +1131 on folds 0-2, warm and cold shifts +1131; contrast x0.8 gets worse (+933 against +1062).
Decision: use gray-world in the product check only, as insurance. Price measured with no light change: ident 1893 instead of 1902 on the five folds (total 3111 against 3120 with x01 stock), 275 instead of 284 in time block (b), equal in (a). Reason: the same camera is likely at the same focus, so blur and contrast changes are unlikely, while a white-balance change between days is plausible; a loss of 250-300 points is worth 9.
Also closed: t02 (blend + own-photo fill block, stock +801 on folds 0-2, +1314 on five folds; below h01d, not adopted).

## The night after the benchmark (Sunday 11/10, 00:00 to 04:00): closing the model fronts

Decision (team, Miguel's agent, docs/BOARD.md 02:20): the submission is André's R3 alone (`agents/predict.py`, weights `ld6ee`, trained on every photo of `eval/labels.json` at d6eeba4). The lab model stays as the cheapest backup. Forward split on the unchanged areas (269): R3 +494 / 538 (seed 1 +483), lab ensemble +456, ens25 +450, Miguel's CLIP + lab min combo +458. R3 cost measured end to end: 2.0 CPU s per photo on one thread (6.6 s start-up); lab `predict_fast.py` 0.106 s warm, 0.3 s to start and answer one photo.
Where the lab stands: image-only ensemble (pixel features + slot references + fine-tuned MobileNetV3, product check = bank of training crops + planogram family check, colours balanced per crop), five folds +3341, forward +423/+424 (labels_v1), +489 (current labels). Training it on the latest labels changes nothing (+494 current, +458 unchanged, -6 on labels_v1): noise.

Closed without adoption, with the reason:
- Forward-aware weight selection (fw01), photo-context two-stage head (cx01), clamp rule for crates emptier than seen (cx01): no gain; in the training photos the last photos of each camera are fuller (restock), so "late means emptier" cannot be learned.
- Synthetic emptying augmentation (sy01), more CNN members of the same family (c02), DINOv2 linear leg (dn01), ConvNeXt-atto as the CNN member (ft02: +21 forward, -3 middle, -16 on folds 0-2; Apache-2.0 weights, 80-100 ms in torch against 28 ms): all inside the noise.
- Label mixture (hg01): training with 0.75 team + 0.25 Sensei-wording labels (mix25) raises the worst-case gain over the four label worlds on every split (forward +0.711 to +0.826 per area for the whole ensemble) and costs about 6 to 18 points on the team key; not adopted because the team submits R3 and because the mixture is a bet on the criterion.
- Minimax decision across label worlds: forward -6 team, +14 to +40 elsewhere; five folds -75 team, +18 to +47 elsewhere: net about zero. Not adopted.
- Free-thinking explorers A, B, C (compare each crate with earlier photos of the same slot; photo-level EM prior and slot novelty; a hand-built visible-floor detector): all below the lab ensemble (stock +50..+66, +125..+133, +89..+102 against +124).
- Probability averages with R3 and CLIP (fusion expert): the only defensible one is lab + R3 at 0.5/0.5 (forward +453 against R3's +450, five folds best pair); inside the noise and 7 times the lab cost.
Findings worth keeping: (1) about 60% of the stock points lost on the forward split sit in areas where the labels disagree with each other (team vs the Sensei-wording consensus differ on 21% of the forward areas, almost all full vs half): getting the criterion right would be worth about 100 points of 604, more than any model change; (2) the label revisions by model-vs-label disagreement move the key toward the models (21 of 28 changed labels agree with the lab model, against 5 before): do not choose models with a revised key; (3) the excess of "above" errors appears only in each camera's last two photos (closing regime), not two photos earlier; (4) the validation-day rehearsal (clean checkout, 26 photos, 289 areas) found the transformers 5.x silent-fallback trap, a missing `--planogram` in the run-book and the lack of `p_stock` in the agents' predictor; fixed or listed in docs/VALIDATION_DAY.md and docs/BOARD.md.
Resource lesson: the laptop rebooted at about 02:30 under several parallel training jobs shared with other sessions; since then every heavy job runs under `flock /tmp/lab-heavy.lock` with at least 4 GB free and two threads.
Open: R3 cost reduction without changing a single answer (wrapper and copies under lab/r3fast/, separate venv; agent running); the 07:45 reminder to choose finalists and rehearse the final command from a clean checkout; the 10:17 reminder before the freeze.

## A human read of 40 disputed crate areas (Sunday 11/10, about 05:00)

Question: when the team labels and the Sensei-wording passes disagree, which one is closer to Sensei's rule (full = leave it, half = staff would replenish, empty = nobody would buy, in doubt the lower level)?
Set: 40 of the 121 disputed forward areas (32 team `full` against LLM `half`, 7 team `empty` against LLM `half`, 1 team `half`). One person read them with the rule, twice: first seeing the lab's opinion, then blind and in another order. 2 of 40 answers changed between passes, totals identical, so seeing the lab's opinion did not move the reading.
Result: the reader agrees with the team on 22 of 40 and with the LLM consensus on 18 of 40. Of the 32 team `full`, 15 stay `full` (47%) and 17 become `half`; of the 7 team `empty`, 6 stay `empty` (the LLM passes say `half`). The reader never says `full` where the team did not.
Scores on the same 40 areas (stock points): lab -24 against the reader (team +26, LLM -98); R3 seed 0 / seed 1 -31 / -28 (team +40 / +36, LLM -112 / -109); constant `half` -29 against the reader, -84 against the team. Both models predict `full` on 30-32 of the 40, as the team does.
Limits: n=40, so the 47% carries about +-16 points; the areas were picked because the two sources disagreed, so this says nothing about the rate over all areas; one reader. A model that copies the team is about 5 to 7 points better under the team labels and as much worse under the reader's, on this subset only.
Decision: no change to the model. It supports keeping the lower level when unsure (already what the expected-points rule does) and asking Sensei for two examples of each level. Closed as a measurement, not as a new branch.

## Human read of all 121 disputed forward areas plus a random sample of the agreed ones (Sunday 11/10, about 06:30)

What was added: the other 81 disputed areas (see the numbers below), and 45 areas drawn at random from the 181 forward areas where the team labels and the Sensei-wording passes agree. One reader, Sensei's rule as written, areas shown with the lab's and a sub-agent's opinion for the 81 and the 45 (the first 40 were read blind twice, 2 of 40 answers changed). The sub-agent read blind on the rule alone.
Disputed (121): the reader agrees with the team on 75 (62%), with the sub-agent on 87 (72%). Of 74 team `full`, 42 stay `full` (57%); of 25 team `empty`, 14 stay `empty` (56%); the reader never says `full` where the team did not. The team labels the extremes more often than the reader does.
Random sample of agreed areas (45): the reader agrees with the team on 41 (91%); 32 of 35 team `full` stay `full`. Estimated over all 302 forward areas: about 62 answers differ (21%), range 52-84 (95% interval of the sample rate 4-21%).
Stock points on the forward split, out of sample (preds_forward files), team labels against the reader's labels extrapolated to all 302 areas (exact on the 121, weighted sample on the rest): lab ensemble +124 -> +34; R3 seed 0 +151 -> +30, seed 1 +142 -> +35; combo_min_crate_R3 +157 -> +85; agents_R0_shipped_s0 +136 -> +85. Every model loses 50 to 120 points; R3's 27-point lead over the lab under team labels is gone under the reader's. The models that lose least are the ones that answer a lower level more often. Sampling noise of the estimate is about +-20 points and the reader is one person: treat the sign, not the size.
Not possible: a held-out test of a model trained on the reader's labels, because every label the reader gave is on a forward-test photo. The lab ensemble was retrained with them (209 s, weights moved from h01d 0.1, r01b 0.6, cnn 0.3 to 0.6, 0.0, 0.4) but can only be scored on the very areas it saw. R3 cannot be retrained from the repo: the training script is not in it (ask Andre).
Correction recorded: a first table scored two lab models trained on every photo, forward included, so it was in sample and was discarded.
Decision: no change to the model at 10:30 from this. It supports lower-level answers when unsure and asking Sensei for two examples of each level; the team decides.

Correction (Sunday 11/10, about 06:50), after Andre's referee check on the board: the table of the previous section mixed two keys (the 121 disputed rows from the current labels, the rest from labels_v1). Redone on the current key (benchmark.py `forward_keys()["current"]`), stock points: R3 s0 +246 -> about +69 under the reader, R3 s1 +231 -> +68, lab +188 -> +42, combo_min_crate_R3 +214 -> +86, agents_R0_shipped_s0 +207 -> +100. Three statements were wrong: the reader's cost is larger than written (R3 -177/-163, lab -146); R3's lead over the lab shrinks (about +58 to +27) but does not vanish; combo_min_crate_R3 does not dominate (it is 32 points below R3 s0 under the current labels, 17 above under the reader's). The full table is in docs/BOARD.md (06:50).

## Training the lab ensemble on sub-agent readings (Sunday 11/10, about 07:05)

Hypothesis: if the reader's criterion is Sensei's, a model trained on labels that follow the written rule should score better against the reader than the same model trained on the team labels. Test: 24+8 Sonnet sub-agents read the 1627 areas of the 151 training photos blind with the rule (74% agreement with the team labels; of 1225 team `full`, 942 stay `full`, 267 become `half`, 16 `empty`; of 290 team `half`, 60 `full`, 57 `empty`; 62% `full` against 75%). Same recipe trained twice with the forward photos excluded (`predict.py train --exclude`, 170 s each), labels = team or agent readings; scored on the forward split (current key) and on the reader's 166 readings (121 disputed exact, 45 random raw, est. = 302-area score + 121-row change + 45-row change x181/45).
Result: team-trained +178 (reader est. +46; 121 rows -53; 45 rows +41 -> +33); agent-trained +53 (reader est. -23; 121 rows -65; 45 rows +26 -> +18). The agent-trained model answers `full` less often (171 against 214 of 302) and is worse under both keys, the reader's included. The agent readings are too noisy to train on directly (they disagree with the reader on about 28% of the disputed rows, and a model learns that noise). Not adopted; the reader's own review of 60 agent labels (40 where they differ from the team, 20 where they agree) is running to measure the label quality itself.

Reader's review of 60 agent-read training labels (Sunday 11/10, about 07:20): 40 where the agent reading differs from the team label and 20 where they agree, shown with the agent's level pre-selected. Where they differ the reader sides with the team in 27 of 40, with the agent in 13 (never with a third level); where they agree the reader approves 19 of 20. Weighted to the 1627 training areas the reader agrees with the team on 88% and with the agent on 79%. The agent readings are the weaker labels (they lower `full` to `half` too often: 17 of the 40 are team `full`, agent `half`, reader `full`), which explains why the ensemble trained on them scored below the team-trained one. Decision: the training labels stay the team's. Hedge and R3mix files from Andre scored once on the reader's key: table in docs/BOARD.md (07:15); nothing wins under both keys.

## Round of four lab agents (Sunday 11/10, 07:15 to 08:05): decision layer, error analysis, fusion, test-time augmentation

Rules for all: parameters chosen on the five folds only, rules and variants written in the file docstring before scoring, each candidate scored once on forward (current key) and on the reader's key (est., noise about +-20). Files: exp_cal_decide.py, exp_err_fixes.py, exp_fuse_rules.py, exp_tta_predict.py.
- cal (temperature + class biases, ordinal form, best k, fitted leave-one-camera-out): no gain; the in-sample +9..+12 on the folds is -8..-11 out of camera; fitting on the folds pulls towards the team key. Not adopted. Only the explicit p(full) factor moves the reader's key (k=0.5: folds -21, forward current -5, reader est. +30); `predict_fast.py --full-weight` exposes it (default 1.0, output byte-identical on 181 photos / 1962 areas).
- err (error analysis and four cheap fixes): 56 of the 58 points R3 leads by on forward sit in 14 areas where the lab answers one level above the truth; 41 on the last photo of each camera. Fixes +0..+8 (noise); the best shift chosen with the forward labels recovers 14 of 58. The gap is image evidence, not calibration. A first/last-photo correction was not tried: it is the hour of the day.
- fuse (R3 two seeds + lab with p(full) factor, 8 rules fixed in advance, forward only): no rule beats R3 s0 under both keys; 0.7 R3 + 0.3 lab with p(full) x 0.7 +240/+84 (current/reader), 0.5/0.5 with the same factor +236/+87, above combo_min_crate_R3 on both; the factor does the work (R3 and the lab disagree on 21 of 304 areas). Re-run by me from the raw p_stock files with the same numbers. Posted to André in docs/BOARD.md (07:55) as a proposal.
- tta (flip / jitter / shift / combo on the CNN member): forward +12..+19 current, +5..+19 reader at +50..+135 ms; validated on the five folds (model trained without each fold, rule fixed in advance: adopt only with +15 pooled and 4 of 5 folds better): flip +14 and 3 of 5, combo +16 and 3 of 5. Not adopted; the forward gain was noise.
Closed: nothing changes in the lab model. Stop rule of lab/AGENTS.md: no more rounds on the lab ensemble; more than 150 looks at these labels by now.

## Second round of agents (Sunday 11/10, 08:00 to 10:00, Lisbon): nothing improves the lab; one robustness fix

Same rules as the first round (tuning on the five folds only, rules written before scoring, one forward scoring per candidate, reader key read as a noisy estimate). All results are negative or noise:
- stack (logistic or per-camera reweighting of the three members, leave-one-camera-out): five folds -3 to -26 against +1448. wsamp (cost-sensitive sample and class weights, ordinal heads): -12 in the ensemble, every weighting loses because `decide` already applies the points matrix. ord (cost-sensitive, earth-mover and ordinal-smoothing losses for the CNN member): -51, -10 and 0 on the folds (forward +10..+24 contradicts them: noise). Closed: no more rounds on the ensemble.
- boot (paired bootstrap over the 28 forward photos, 26 per draw): R3 beats the lab with probability 1.00 (current key) and 0.96 (reader key); the cascade at tau 0.9 is R3 on forward; R3mix against its control and lab k=0.5 against the lab are decided by the label convention, not by noise; under the reader's key the lab with k=0.5 wins the grade in all five cost-scoring assumptions, under the current key the cascade wins four.
- shift (diagnostic): the stock level rises over the first two thirds of each camera's photos and falls on the last two; the lab over-calls about twice as often there (9% above against 3%); a validation set that follows the last photo should score about 60 points below the five-fold figure per 289 areas. A rule without the hour (answer lower when p is below a threshold) would not have helped (loses in 3 of 5 folds).
- pattern (descriptive): the reader's `half` on team `full` is concentrated in the disputed areas (43% against 6% in the random ones); nothing cheap separates them from the agreed ones; the one rule that does is a camera-6376 fit.
- robust: R3 moves 0 to 3 stock answers under JPEG q40/q70, noise, resize, brightness, 1-degree rotation and a 2% crop; the lab 3 to 17 (a 2% crop costs it 11 points), in both directions, noise on 28 photos; no perturbation breaks the output format.
- r3cost: R3's forward is near the AVX2 ceiling of one core (96 ms per crop); the free speedups (no `transformers`, array once per photo, skip the curtain log lookup) give about 6% end to end; the rest changes answers. Proposal to André in the agent's report.
- edge (26 input cases on both commands): R3 copes with all realistic layouts; the lab dropped `.png` silently, died on macOS `._x.jpg` files and on any unreadable image, and needed an exact camera folder name. Fixed in `predict_fast.py` (a338c53): output byte-identical on the 181 photos; the cases are listed in lab/PREDICT.md.
- lit (web search): nothing published combines ordinal, asymmetric cost and noisy labels; expected-cost decision and abstention to the lower level are what the lab already does; MobileNetV4 and DINOv2 distillation are untested ideas for cost, not for 2 hours.
