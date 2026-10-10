# Tasks per person

Deadline: Sunday. The score is the sum over areas (max 578). See `docs/PLAN.md` for the strategy.
Golden rule: work on your own branch (`name/topic`), open a PR to `main` and commit with your own account.

## Done so far

- `backend/crops.py`: crop of each area with a homography.
- `backend/baseline.py`: colour-based stock (calibrated per area over the day) and compliant = true.
- `eval/score.py`: scorer with the PDF rules.
- `backend/debug_view.py`: draws the predicted stock on an image.
- Known limits: products with little colour (pineapple) come out as "empty". On some cameras (for example 6468) a product different from the planogram appears, so compliant cannot always be true.

## Status, Saturday evening

- All 1962 areas of the 181 photos are labelled (`eval/labels.json`), with 73 notes and the log of who did what.
- Supervised model (`python -m sensei train`): 489 / 578 in 5-fold CV holding out whole photos; two
  rehearsals of the real submission command on 28 hidden photos gave about 461 and 472 / 578.
  The label-free model gets about 180-200.
- Product checks are almost perfect in CV. The points left are stock, mostly half vs full.
- Labels used for training = team labels + André's review: his answer wins on the product (31 areas,
  e.g. 6376_4 holds lemon bags, 6594_2 onion nets) and where he said empty and we said half (24 areas,
  Sensei's "one or two units left" rule).
- Tried and dropped: a whole-crate crop (488 vs 489, no gain), so redrawing the area polygons by hand
  is not worth the time. CLIP "person" prompts on crops (bananas look like arms).
- Shoppers in front of an area: a COCO person detector on the full photo (no false alarms on our
  181 photos at score 0.85). Covered areas fall back on the nearest labelled photos, rounding down.

## Next, by person

**Leonor: Sensei answers (highest value, today).** Show `docs/sensei_questions.jpg` to the Sensei
mentors and write their answers in `docs/SENSEI_INFO.md`: half vs full (2 cases), empty vs half
(2 cases), whole crate vs outlined area, shutter photos. Then the pitch and demo script.

**José: clean the labels (about 20 minutes).** In the app, Label tab, press "Review suspects":
90 labels the model strongly disagrees with. Fix the ones that break the rule; leave the ones that
are right. After the Sensei answers, apply their rule to the same list.

**André: apply the Sensei rule to the whole set.** If they say full = "looks full", turn the
team's strict halves back to full where the crate looks full (start with the 32 areas where you said
full and we said half). Then `python -m sensei train` and `python rehearse.py --seed 3`.

**Miguel: freeze and submit.** Retrain after each label change, keep the change only if the CV and
rehearsal scores go up, follow `docs/VALIDATION_DAY.md`. Freeze on Sunday morning.

**Everyone:** nothing new after Sunday morning; the app is the tie-breaker, so the demo should open
on the Tasks tab with real predictions.

## Original split (Friday)

### Miguel: AI pipeline (the core of the score)

1. Product classifier per area (VLM or CLIP/SigLIP) for `planogram_compliant`. It depends on the organisers allowing external APIs.
2. Better stock estimator (empty, half, full) and the decision with the cost matrix (lean low).
3. Handling of images with a curtain or hands in the way.
4. Generate the final submission file in the required format.

### José: app and integration

1. `backend/`: a FastAPI API that reads `outputs/predictions.json` and serves it by camera, image and area.
2. `frontend/`: the staff view, with a prioritised list ("restock first / move back to place / ok") and a map of the gondola with the areas coloured over the image. It breaks ties, but it has to be clear in 5 seconds.
3. Deploy (Vercel) and a link to the demo.

### André: evaluation and data (second technical brain)

1. Quick labelling tool (a script or a simple page): shows the crop and the expected product and saves `empty/half/full` and `compliant` to `eval/labels.json`. Leonor uses it.
2. Run the scorer on `eval/labels.json` and show the score per camera and per error type (above, below, identification), to see where points are lost.
3. Tune the baseline thresholds (`EMPTY_BELOW`, `HALF_BELOW` in `baseline.py`) with those labels.
4. Look through the images: a list of images with a curtain, people in the way, and cameras where the planogram does not match.

### Leonor: labelling, product and pitch (no heavy code)

1. Label about 40-60 areas by hand with André's tool, varied by camera and time and including hard cases. This is our "validation" and it is worth points directly.
2. Write the pitch (problem, solution, impact: less waste, fewer empty shelves, audits without people) and the demo script (2-3 min).
3. Design: a prototype (Figma or paper) of the staff screen for José to build, plus the Strivon logo and name, and the slides.
4. Final README and the demo video.

## Suggested deadlines

- Saturday morning: Leonor's labels and the app reading predictions.json.
- Saturday night: product classifier integrated and the score measured on the labels.
- Sunday morning: freeze the model, generate the submission, rehearse the pitch. Nothing new after this.
