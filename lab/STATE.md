# Lab state

Updated: Sunday 11/10, about 10:00 Lisbon, before the freeze.

## Hand-off for the team

The lab model is a cheap image-only ensemble: pixel features of the area, per-slot references and a small MobileNetV3, plus a product check against a bank of training crops. It costs about 0.1 s of CPU per photo. On the team benchmark it is row 8 (+3341 of 3858 on the five folds). R3 is ahead of it on the forward split by about 58 stock points under the current labels and about 27 under a stricter reading of Sensei's rule. The team decided at 02:20 to submit R3 alone, and the lab model is the cheap backup.

What is in git (all under `lab/`):
- `predict_fast.py` is the backup's predict command, usage in `PREDICT.md`. It needs `lab/models/lane_i_ens.pkl`, which is not in git because it holds colour histograms of the photos. Copy it from Jose's laptop, or rebuild it with `python lab/predict.py train --model ensemble --out lab/models/lane_i_ens.pkl` (about 4 minutes on two threads; the ensemble weights change a little between runs, the answers differ on about 2% of the stock levels).
- `predict_fast.py --full-weight 0.5` answers one level lower when unsure. Default 1.0 changes nothing. On the lab it costs about 3 points per 289 areas under the team labels and gains about 30 under the stricter reading.
- `predict_fast.py` also reads `.png`, skips macOS `._x.jpg` files, accepts folder names such as `camera_6215/`, answers an unreadable image with `full` and compliant (as R3 does) and warns. The output for a normal folder is byte-identical to the previous version.
- `EXPERIMENT_LOG.md` has the reasoning for every closed front and the numbers of tonight's work. The judges (`run2` to `run6`), the experiments, the label passes and the agent scripts are on the branch `jose/lab`, not on `main`.
- `labels_reader166.json` holds the 166 forward areas read by one person with Sensei's rule: camera, photo, area and level.
- `r3fast/` has `dinov2_lite.py` (adopted by André), `cascade.py` (a prototype that runs R3 only on the areas the lab is unsure about) and the R3 timing scripts.

What is not in git, on Jose's laptop in `lab/handoff/`: `PARA_EL_EQUIPO.html` (one page in Spanish with the options, the choice once Sensei answers and the fifteen examples with photos, for the people next to Jose), `dos_criterios.html` (the 166 readings against the team labels, with the photos), `ejemplos_sensei.html` (15 example crops to ask Sensei where the levels start), `labels_v1_con_lectura.json` and the lab model trained on it. They hold photos or weights, so they stay out of git.

What tonight showed:
- The reader agrees with the team on 75 of the 121 disputed areas and on 41 of 45 areas drawn at random from the agreed ones; about 62 of the 302 forward answers (21%) would change. The reader never says `full` where the team did not.
- Stock points on the forward split, current labels against the reader's labels (extrapolated): R3 +246 / +231 to about +69 / +68, lab +188 to +42. Every model loses 100 to 180 points, and the models that answer a lower level more often lose least.
- Training the lab on sub-agent readings of the 1627 training areas scored worse than on the team labels, under both keys. The reader reviewed 60 of those readings and sided with the team in 27 of 40 disagreements.
- Nothing improves the ensemble: the decision layer, stacking, cost-sensitive heads, ordinal losses and test-time augmentation were all tested with rules fixed in advance (see `EXPERIMENT_LOG.md`). The 58-point gap to R3 sits in 14 areas where the lab answers one level too high, mostly on each camera's last photo.
- A validation set that follows our last photos should score about 60 points below the five-fold figure per 289 areas, because the models over-call at the end of the restock cycle.
- Where the numbers are: `docs/BOARD.md` (06:50, 07:15, 07:55, 08:25) and `docs/DECISION_BRIEF.md`.

Open before the freeze (10:30 Lisbon, our own target; submissions close at 13:00 on the hacker dashboard, zone to confirm): André's choice at 09:00 between R3 as it is and `--stock-model mix`; Sensei's answer on how it separates the levels and how the cost is scored; whether anyone wants the cascade or the lab with `--full-weight`. Nothing in the lab changes the submission by itself.

## Earlier state

Branch `jose/lab` (worktree `~/Proyectos/Strivon-lab`, pushed to origin). Environment: `.venv` (numpy, scikit-learn, opencv, torch, timm), `data/` linked from the main clone.

Judges: `run.py` (leave one camera out, round 1), `run2.py` (leave one camera out, all worlds), `run3.py` (frozen test of 28 photos, headline). Logs: `results.jsonl`, `results2.jsonl`, `results3.jsonl`.

Best candidates so far (run2 worst-world gain / H gain): t04 -0.78 / +0.43; u03 -0.24 / -0.14; r06 -0.24 / -0.23; e04 -1.04 / +0.51; u01 -0.97 / +0.58.
run3 H gain on the frozen test: e02 +0.59, a04 +0.37, d03 +0.18, exp_000 -0.03.

Rubric v2 labelling (silver2): all 14 cameras complete in both passes (p3 Sonnet, p4 Opus). Agreement report: `.venv/bin/python lab/silver2_report.py` (v2 vs humans 77-81% exact; the v2 passes agree with the humans far more than the strict v1 passes did). Next actions below now take this into account.
Was in flight: 14 labelling agents for rubric v2 writing `lab/silver2/p3_<camera>.json` (Sonnet) and `p4_<camera>.json` (Opus, reverse order). Round-2 agents that may still be finishing: v (small VLM). Labelling is finished: do not relaunch it unless the rubric changes.

Update: H is now the reference world and the v2 worlds N1, N2 (and their agreement) are its confirmation; deprioritise models bought for the strict worlds. Next actions: (1) when `silver2` is complete, add worlds N1, N2, CN to `run2.py` and `run3.py`; (2) re-score the candidates with `run3.py`; (3) leakage audit of t04, e04, u03; (4) round 3 per `ROADMAP.md`.

Known traps: agents overwrote a shared helper script once (give each agent its own folder under /tmp); `run2` and `run3` predict every area of the held-out camera or test photos, so cached features must exist for all 181 photos; the hour of the day as a feature collapses the late photos.

Gate A done: judges have worlds N1, N2, CN, HN and `worst_v2`/`mean_v2` (commit 4bc6069). Re-scored on the frozen test: e02 worst_v2 +0.419 (H +0.585), u01 +0.389, e04 +0.385, t03 +0.239, a04 +0.227, t04 -0.637. Leakage audit of e02, u01, e04: clean (see `EXPERIMENT_LOG.md`). Base model: e02. Dropped: t04, u03-u06, r06, p05, e04, t03. Next: round 3 on e02 with v2-world labels, cheap embeddings, late photos, cost. Leak risk to check before reusing: `held = test_rows[0]["cam"]` in `exp_u_lib.py` and consensus training in t04 under `run3`.

Update, Saturday night: the exam is the team benchmark (`run5.py`), with time blocks (`run6.py`) as a stress check. Primary candidate: image only = `exp_x01_noclip_blend.py` (pixel features, logistic + trees, no CLIP columns) + `exp_p01_hsv.py` (product check against a bank of training crops): 3099 of 3858 on run5, ties the neighbour models in the time-block tests. Neighbour lane (d01 + c01 3264) kept as documentation. Open: leakage audit of the final model, cold cost measurement on 2 threads, `predict` command, one pass on a fresh draw, leaderboard row (branch `jose/lab-leaderboard`, no PR until André's rows are merged). Not mine, left alone: a `sensei train` process from another session; `exp_v01_vlm_stack.py` and `exp_d01_priorshift.py`.

Update, Saturday late night: final image-only candidate = ensemble e01 (`exp_e01_wcv3.py`: h01d + r01b + fine-tuned CNN) with compliance `exp_v01_family.py` (V01_FEAT=hsv V01_COMBINE=1): benchmark 3350 of 3858, in main (PR #27) as the lab row; PR #18 and #25 also merged (earlier row, cheaper combined row), PR #20 fixed the name spelling. Half-vs-full line closed (h01, h02, b02). Open: `lab/predict.py` for the ensemble (agent running), cold cost on an idle machine, then update the row's seconds. Not mine, left alone: a `sensei train` from another session; `exp_v01_vlm_stack.py`, `exp_d01_priorshift.py`. Never commit `lab/models/`, `lab/preds5/`, `lab/cache/` (ignored).

Update, Sunday 03:30: team submission = André's R3 (agents/predict.py, ld6ee) alone; the lab model (lab/predict_fast.py, e01 ensemble) is the cheap backup. All lab model fronts are closed (see EXPERIMENT_LOG.md, "The night after the benchmark"). Running: cost reduction of R3 with identical answers (lab/r3fast/, own venv with transformers 4.57). Rules for the night: only touch lab files, merge only own PRs, one heavy job at a time under flock /tmp/lab-heavy.lock with >= 4 GB free. Not mine: exp_v01_vlm_stack.py, exp_d01_priorshift.py, other sessions' worktrees. Reminders at 07:45 and 10:17.
