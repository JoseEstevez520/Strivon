# common/ — shared data layer (owner: -d1)

Message -d1 if you need something changed here; please don't edit these files yourself.

## Import it

`py -I` doesn't put the script's folder on `sys.path`, so add the project root first:

```python
import sys, pathlib
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[2]))  # for models/<x>/file.py
from common import load_planogram, list_images, load_image, rectify, submission
```

## Data

| call | returns |
|---|---|
| `load_planogram()` | `{cam: [area, ...]}`. Each `area` is the raw planogram.json entry (`area_id`, `product_id`, `product_name`, `image_coordinates`). These dicts are cached, so don't mutate them. |
| `areas_by_id()` | `{area_id: area}` |
| `list_images(root=IMAGES_DIR)` | sorted `[ImageRec]`, each with `.cam`, `.ts`, `.path`, `.fname` (`'1751052241.jpg'`), `.time` (Lisbon datetime), `.hhmm`. Works on any folder: the camera comes from a `<cam>/` folder or a file-name part, or else from its appearance. |
| `load_image(path)` | RGB `PIL.Image`. Every camera is 1280×720. |
| `neighbors(cam, ts, k=2)` | the k dataset images of that camera closest in time |
| `identify_camera(img)` | `(cam, score)`, matched by looking at the image |
| `OVERLAP_PAIRS` | camera pairs that see the same crates from different angles |

## Crops (accept a PIL image or an RGB ndarray, return the same type)

| call | returns |
|---|---|
| `quad(area)` | (4,2) float32 corners in the order TL, TR, BR, BL. Corners may be negative. |
| `rectify(img, area, size=(224,224))` | the area perspective-warped to a straight-on patch; `size=None` keeps native resolution |
| `rectify_mask(area, size)` | bool mask of which patch pixels are real (5 areas on 6383/6386 stick out of the frame) |
| `bbox_crop(img, area, pad=0)` | unwarped rectangle around the area, with context |
| `polygon_mask(area, img_size)` | bool (H,W) mask of the polygon on the full image |
| `visible_fraction(area)` | share of the area that is inside the frame |
| `native_size(area)` | (w,h) that keeps the area's on-image resolution |

### Crate crop (stock is judged on the whole crate)

Every geometry function also accepts `expand_depth=`, `expand_front=` and `clip=True`:
`rectify(img, area, (224, 224), expand_depth=0.25)`, `rectify_mask(area, size, expand_depth=0.25)`,
`quad(area, expand_depth=0.25)`, and the same for `native_size`, `bbox`, `bbox_crop`, `polygon_mask` and `visible_fraction`.

- `expand_depth`: the top (back) edge moves away from the bottom edge, along each side, by that fraction of the side.
- `expand_front`: the bottom (front) edge moves the other way.
- The sides stay on their own lines, so side-by-side slots never swallow each other.
- A moved corner stops at the image border, and a corner that is already off-frame (the 6383/6386 top shelf) doesn't move.

**Shared per-area values:** `expand_depth='auto'` reads `common/crate_expand.json` (`{area_id: depth}` or
`{area_id: {"depth": x, "front": y}}`; unlisted areas = 0). It lists only areas whose polygon really cuts the crate:
wall top rows, the island trays and middle rows. Pictures: `viz/d1/crate_auto_<cam>.jpg` (green = polygon, magenta =
auto). Crops: `cache/crops_auto/`. Ask -d1 to change a value.

Defaults are 0, which gives exactly the old crop. Try 0.25 and 0.4. Above about 0.3, middle-row crates start reaching
the shelf above; see `viz/d1/crate_crop_6376.jpg`. Pre-built 224×224 crate crops at 0.25 are in `cache/crops_d25/`,
with the same index columns as below.

## Crop cache (already built)

`cache/crops/<cam>/<ts>/<area_id>.jpg` holds the 1962 rectified 224×224 patches. `cache/crops/index.csv` has columns
`area_id, cam, ts, fname, time, product_id, product_name, crop, image, visible_frac, native_w, native_h`,
with paths relative to the project root. To rebuild: `py -I common/export_crops.py` (`--size 0` for native resolution).

## Submission format

```python
sub = {}
submission.put(sub, cam, fname, area_id, compliant=True, stock_value=0.5)  # snaps to 0/0.5/1, fills stock_level
submission.fill_missing(sub, images)          # safety net: every area of every image present
errors, warnings = submission.validate(sub, images)
submission.write(sub, "preds/<suffix>_<tag>.json")
```

From the command line: `py -I submission/validate.py preds/x.json --images "<image folder>"`. Exit code 0 means no errors.
