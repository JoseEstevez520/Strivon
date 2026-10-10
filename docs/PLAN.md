# Sensei challenge plan (JunctionX Lisbon 2026)

Deadline: Sunday. Goal: score as many points as possible on the validation set (max 578) and have the best UI/UX for the tie-break.

## How it is scored (per planogram area, 289 areas)

| Field | Right | Wrong |
|---|---|---|
| `planogram_compliant` | +1 | -2 |
| `stock_value` (0 / 0.5 / 1) | +1 | -2 if below the real stock, **-3 if above it** |

An area missing from the output counts as -2 and -3. **Always answer every area.**

### What this means

- Overestimating stock costs more (-3) than underestimating it (-2), so when in doubt pick the lower level.
- In the PDF example about 93% of areas are compliant, so the default is `planogram_compliant = true` unless there is evidence of an error.
- For each area, pick the class that minimises the expected loss, not the most likely one.

## Data

- 14 cameras, about 13 images per camera (train and test, no annotations), 1280x720, one full day of operation.
- `planogram.json`: 152 areas with 4 corners each (quadrilaterals in perspective, some coordinates can be negative).
- The validation set is hidden: 26 images, 289 areas. The output format is `{cam: {img.jpg: {area_id: {planogram_compliant, stock_level, stock_value}}}}`.

## Approach (no labels)

1. **Crop each area.** Warp each quadrilateral into a rectangle with a homography and clamp the parts outside the image.
2. **Product classification** (`planogram_compliant`). Zero-shot with CLIP/SigLIP or a VLM, comparing the crop with `product_name`.
3. **Stock level.**
   - Unsupervised calibration per area: over the day each area has empty and full images, so use the emptiest crop (dark gondola background visible) and the fullest one as anchors and normalise between them.
   - Features: share of pixels that are not background or gondola, embeddings, blob counts.
   - Optional: a VLM (Claude or Gemini) classifying each crop as empty, half or full.
4. **Decide with the cost matrix**, leaning towards lower stock.
5. **Pseudo-validation.** Label about 30-40 areas by hand (the team) to measure the score with our own scorer.
6. **App and UI.** A dashboard for staff (what to restock first, what to move back). It breaks ties, so it has to be clear.

## Tasks and owners (to confirm)

- [ ] Repo and structure (José)
- [ ] Crop pipeline per area, with polygon visualisation (Miguel)
- [ ] Local scorer that replicates the PDF rules (Miguel)
- [ ] Hand-label about 40 areas for pseudo-validation (Leonor and everyone)
- [ ] Zero-shot product classifier (André)
- [ ] Stock estimator (Miguel and José)
- [ ] UI and dashboard (José, Leonor on design)
- [ ] Pitch, demo and README (Leonor and Miguel)
- [ ] Submission in the required format (everyone reviews it first)

## Dataset notes

- Some images (for example the first one of 6383, taken at night) show the display covered by a curtain, so the crops are a plain wall. We need to detect "covered" and decide the output (probably empty and compliant = true). Confirm with validation images if there are any.
- Polygon alignment checked by eye on 6383 and 6468: good.
