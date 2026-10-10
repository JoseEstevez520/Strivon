# André's labels (review round, 10 Oct)

434 hand-checked area-photos from the 181 train/test photos: 126 photos, all 14 cameras.

## Files

- `labels_andre.json`: same format as the hidden `annotations.json`,
  `{camera: {image: {area_id: {planogram_compliant, stock_level, stock_value}}}}`.
  It works directly with `eval/score.py`.
- `labels_andre_detailed.json`: the same labels plus `actual_product` (when not compliant), `unsure` and `occluded`.
- `notes.csv`: notes left while labelling.

## How these areas were chosen

This is not a random sample. AI agents pre-labelled every area. These 434 are the ones where they
disagreed or were unsure, plus every suspected wrong product, so they are the hardest cases. A model
scores lower on them than on a random set of areas.

## Rules used

- **Judge the whole crate** the area stands for, even where the planogram lines cut part of it off
  (e.g. 6376_12, the 6215 banana trays). If several areas share one crate (narrow slots such as
  6376 #7/#8/#9), judge each slot.
- **Empty**: time to restock, meaning nothing or only 1 or 2 units left. In narrow slots that only fit 1 to 3
  packs, judge how full the slot looks.
- **Half**: clearly depleted, more than 1 or 2 units left.
- **Full**: looks full, well stocked, nothing to do, even if a few units are missing.
- Stock counts what is physically there, whatever the product. An area full of the wrong product is
  full and not compliant.
- A nearly empty crate whose few items are the wrong product is not compliant. If some of the planned
  product is still there, it is compliant.
- The night-curtain photos (06:12 on 6383 and 6386) are not included.

**Open question for the team:** the `full` rule here is the loose reading. `docs/SENSEI_INFO.md` (since
17:52) says full is completely full, a missing unit makes it half, and doubtful cases round down. We
should agree on one reading. Until then, read `full` in these files as "looks full".

## Counts

full 306, half 74, empty 54. 92 areas not compliant.
