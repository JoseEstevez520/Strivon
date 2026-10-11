# Label-free stock from pixels (experiment, 11 Oct)

The brief asks for a solution that "can be switched on in a new store with no labelling effort". This tests how far stock goes with **no labels at all**. The labels in `eval/labels.json` are used only to score the result at the end.

## Method
- Each area is warped to a 128 px crop.
- Simple texture and colour features are computed per crop:
  - edge density
  - Laplacian variance
  - flat-pixel share
  - saturation
  - dark-pixel share
- Each feature is turned into a robust z-score against the same area's photos of the day. The typical photo is assumed to be full.
- A low score means the crate floor is showing, so the area is empty or half.
- Thresholds were fixed before scoring, and every variant tried is reported, not only the best.

## How to run

```bash
python lab/labelfree_pixels/feats.py
python lab/labelfree_pixels/evalpix.py
```

- `feats.py` writes `feats.json`. That file is not in git, because it comes from the challenge photos.
- `evalpix.py` scores the full day. `evalfwd.py` scores the later half of each camera, using only earlier photos.

## Results: stock points only, all 1,962 labelled areas

| | Total | Per area |
|---|---:|---:|
| Always full | -42 | -0.021 |
| Texture, conservative (-3.5 / -2) | +175 | +0.089 |
| All 9 variants | +120 to +175 | |

- Every variant beats always-full.
- It finds about 40% of the empty crates and almost never confuses full with empty.
- It almost never gets `half` right.
- For comparison, the supervised submission (R3 mix) gets about +0.8 stock points per area on the forward split, so labels are worth about ten times more.

**Limits**
- It compares each photo with the same area's other photos of the day. Sensei asked for the image under analysis only, so this is **not** a submission candidate: it is the "new store, day one" path.
- With only earlier photos available (live use), the gain shrinks: break-even over the whole day, +5 to +45 on the later half.

## Failed idea: `dino_deviation_failed.py`
- Same idea, but on the distance of frozen DINOv2 block-4/8 features from the area's typical look.
- Worse than always-full: -81 at best, about -1,100 when only earlier photos are used.
- Semantic features move with lighting and with neighbouring products more than with how full the crate is.
