# Tasks per person

Deadline: Sunday. The score is the sum over areas (max 578). See `docs/PLAN.md` for the strategy.
Golden rule: work on your own branch (`name/topic`), open a PR to `main` and commit with your own account.

## Done so far

- `backend/crops.py`: crop of each area with a homography.
- `backend/baseline.py`: colour-based stock (calibrated per area over the day) and compliant = true.
- `eval/score.py`: scorer with the PDF rules.
- `backend/debug_view.py`: draws the predicted stock on an image.
- Known limits: products with little colour (pineapple) come out as "empty". On some cameras (for example 6468) a product different from the planogram appears, so compliant cannot always be true.

## Miguel: AI pipeline (the core of the score)

1. Product classifier per area (VLM or CLIP/SigLIP) for `planogram_compliant`. It depends on the organisers allowing external APIs.
2. Better stock estimator (empty, half, full) and the decision with the cost matrix (lean low).
3. Handling of images with a curtain or hands in the way.
4. Generate the final submission file in the required format.

## José: app and integration

1. `backend/`: a FastAPI API that reads `outputs/predictions.json` and serves it by camera, image and area.
2. `frontend/`: the staff view, with a prioritised list ("restock first / move back to place / ok") and a map of the gondola with the areas coloured over the image. It breaks ties, but it has to be clear in 5 seconds.
3. Deploy (Vercel) and a link to the demo.

## André: evaluation and data (second technical brain)

1. Quick labelling tool (a script or a simple page): shows the crop and the expected product and saves `empty/half/full` and `compliant` to `eval/labels.json`. Leonor uses it.
2. Run the scorer on `eval/labels.json` and show the score per camera and per error type (above, below, identification), to see where points are lost.
3. Tune the baseline thresholds (`EMPTY_BELOW`, `HALF_BELOW` in `baseline.py`) with those labels.
4. Look through the images: a list of images with a curtain, people in the way, and cameras where the planogram does not match.

## Leonor: labelling, product and pitch (no heavy code)

1. Label about 40-60 areas by hand with André's tool, varied by camera and time and including hard cases. This is our "validation" and it is worth points directly.
2. Write the pitch (problem, solution, impact: less waste, fewer empty shelves, audits without people) and the demo script (2-3 min).
3. Design: a prototype (Figma or paper) of the staff screen for José to build, plus the Strivon logo and name, and the slides.
4. Final README and the demo video.

## Suggested deadlines

- Saturday morning: Leonor's labels and the app reading predictions.json.
- Saturday night: product classifier integrated and the score measured on the labels.
- Sunday morning: freeze the model, generate the submission, rehearse the pitch. Nothing new after this.
