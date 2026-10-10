"""End-to-end run: image folder + planogram.json -> submission JSON in the official annotations.json format.

    py -I predict.py --images "<folder>" --out submission/<name>.json

The folder can be laid out as <cam>/<ts>.jpg (like the train set) or flat. By default both answers come from the
one-pass image-only model (models/onepass/onepass.py: one DINOv2-S pass per photo, -4e's weights in
models/stock_4e/deploy/; env ONEPASS_SIZE, ONEPASS_DEVICE, ONEPASS_THREADS). Model files are called per image:

    predict_stock_image(img, cam, areas, ts) -> {area_id: answer}   (optional)
    predict_stock(img, cam, area, ts) -> answer                     (for areas the above didn't answer)
    FALLBACK_STOCK                                                  (module missing, exception or bad value)

where a stock answer is a level (0 / 0.5 / 1 or a word) or probabilities {0: p, 0.5: p, 1: p}. Repeat
--stock-model to average several models' probabilities; the level with the best expected points wins.
Compliance works the same with predict_compliant_image / predict_compliant / FALLBACK_COMPLIANT. `ts` and
`context` are only passed to functions that declare them, and an optional module-level prepare() is
called once first. Every area of every image always ends up in the output, since a missing area costs -5.

Night curtain: the look-up that compares a 6383/6386 photo with our stored photos (common.curtain_down) is LOG ONLY
(team decision: comparing with other photos is a grey zone under "only the image under analysis"); the answers
always come from the models, which give empty + compliant on our curtain photos by themselves. A compliance model
that marks areas as covered (explain_compliant_image, same photo only) still gets empty + compliant for them.

Single image (default, the only mode allowed for the submission). Sensei: "You should only consider information
from the image under analysis", and the model should not learn from the time of day. So every model gets
context=False, ts=None and env SENSEI_SAME_DAY_CONTEXT=0: only this photo's pixels and what the model learned in
training. prepare() gets no image list. The compliance model also runs without its same-area look-up cascade and
crate groups (COMPLIANCE_CASCADE_TAU=0, COMPLIANCE_GROUPS=0, as in the benchmark's single-photo row) unless those
env vars are set explicitly.
--same-day-context on-NOT-FOR-SUBMISSION: experiments only. The models may use our other photos of the day and
the timestamp. NOT ALLOWED FOR THE SUBMISSION.
"""
import argparse
import importlib.util
import inspect
import math
import os
import sys
import time
import traceback
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parent
sys.path.insert(0, str(ROOT))

from PIL import Image, ImageFile  # noqa: E402

from common import CURTAIN_PHOTOS, IMAGE_SIZE, curtain_down, list_images, load_image, load_planogram, submission  # noqa: E402
from common.data import _curtain_refs  # noqa: E402
from common.paths import IMAGES_DIR, PLANOGRAM_PATH  # noqa: E402

# Answers used when a model is missing or fails on an area. Revisit once we have labels.
FALLBACK_COMPLIANT = True
FALLBACK_STOCK = 1
# planogram_compliant for areas we predict EMPTY (organizer question #2): "model" keeps the compliance
# model's answer, "empty_true" / "empty_false" override it.
EMPTY_RULES = {"model": None, "empty_true": True, "empty_false": False}
EMPTY_RULE = "model"
# Sensei (10/10 evening): "only consider information from the image under analysis" -> single image only.
# True (same-day context, timestamps) is for experiments and is NOT ALLOWED FOR THE SUBMISSION.
SAME_DAY_CONTEXT = False
CONTEXT_ON = "on-NOT-FOR-SUBMISSION"


def load_module(path):
    """Import a model file by path; None (with a warning) if it is missing or fails to import."""
    path = Path(path)
    if not path.exists():
        print(f"WARN  {path} not found - using fallbacks")
        return None
    spec = importlib.util.spec_from_file_location(f"sensei_{path.parent.name}_{path.stem}", path)
    mod = importlib.util.module_from_spec(spec)
    try:
        spec.loader.exec_module(mod)
    except Exception:
        print(f"WARN  importing {path} failed - using fallbacks\n{traceback.format_exc()}")
        return None
    return mod


def warn_name_clashes(*mods):
    """Both models share one process, so a bare `import embed` in either resolves to whichever model
    folder comes first on sys.path. Warn when a helper name exists in both folders and got imported."""
    dirs = [Path(m.__file__).resolve().parent for m in mods if m is not None]
    if len(dirs) < 2:
        return
    for name in set.intersection(*({p.stem for p in d.glob("*.py")} for d in dirs)):
        if name in sys.modules:
            print(f"WARN  {name}.py exists in both {dirs[0].name}/ and {dirs[1].name}/; "
                  f"both models now use {sys.modules[name].__file__}")


def takes(fn, name):
    """Does fn declare a parameter `name` (or **kwargs)?"""
    return any(p.name == name or p.kind == p.VAR_KEYWORD for p in inspect.signature(fn).parameters.values())


def call(fn, *args, ts=None, context=False):
    """fn(*args) plus ts= and context= for the ones fn declares. Single image (context=False): ts is always
    None, so no model can use the time of day or find "earlier frames"."""
    kw = {}
    if takes(fn, "context"):
        kw["context"] = context
    if takes(fn, "ts"):
        kw["ts"] = ts if context else None
    return fn(*args, **kw)


def clean_stock(v):
    """Probabilities {0: p, 0.5: p, 1: p} from a model answer: a probability dict (normalised) or a hard
    level as a number or word (one-hot). None if unusable."""
    if v is None or isinstance(v, bool):
        return None
    try:
        if isinstance(v, dict):
            p = {}
            for k, x in v.items():
                p[submission.snap(k)] = p.get(submission.snap(k), 0.0) + float(x)
        else:
            if not isinstance(v, str) and math.isnan(float(v)):
                return None
            p = {submission.snap(v): 1.0}
        total = sum(p.values())
        if not total > 0 or any(math.isnan(x) or x < 0 for x in p.values()):
            return None
        return {k: x / total for k, x in p.items()}
    except (KeyError, TypeError, ValueError):
        return None


def combine_stock(answers):
    """Average the stock probabilities of several models (None = that model had no answer) and pick the
    level with the best expected points; FALLBACK_STOCK if no model answered."""
    ps = [p for p in answers if p is not None]
    if not ps:
        return FALLBACK_STOCK
    return submission.best_stock({lv: sum(p.get(lv, 0.0) for p in ps) / len(ps) for lv in (0, 0.5, 1)})


def clean_compliant(v):
    """bool from a bool/numpy bool/0-1 int, a probability (>= 0.5) or 'true'/'false'; None if unusable."""
    if v is None:
        return None
    if isinstance(v, str):
        return {"true": True, "false": False}.get(v.strip().lower())
    try:
        f = float(v)
    except (TypeError, ValueError):
        return None
    return None if math.isnan(f) else f >= 0.5


class Task:
    """One output field with its fallback chain: per-image fn -> per-area fn -> constant."""

    def __init__(self, name, mod, image_fn, area_fn, clean, fallback, context=False):
        self.name, self.mod = name, mod
        self.image_fn = getattr(mod, image_fn, None) if mod else None
        self.area_fn = getattr(mod, area_fn, None) if mod else None
        self.clean, self.fallback, self.context = clean, fallback, context
        self.sources = Counter()
        self.errors = []
        self.seconds = []  # wall time per image
        if not context:
            for fn in (self.image_fn, self.area_fn):
                if fn is not None and not takes(fn, "context"):
                    print(f"WARN  {name}: {fn.__name__} has no `context` parameter: it gets ts=None but can't be"
                          " told to stay single-image")

    def predict(self, img, cam, areas, ts):
        t0 = time.perf_counter()
        out = self._predict(img, cam, areas, ts)
        self.seconds.append(time.perf_counter() - t0)
        return out

    def _predict(self, img, cam, areas, ts):
        out = {}
        if self.image_fn:
            try:
                got = call(self.image_fn, img.copy(), cam, areas, ts=ts, context=self.context) or {}
                for a in areas:
                    v = self.clean(got.get(a["area_id"]))
                    if v is not None:
                        out[a["area_id"]] = v
                        self.sources["per-image fn"] += 1
            except Exception as e:
                self.errors.append(f"{cam}/{ts} per-image fn: {e!r}")
        for a in areas:
            if a["area_id"] in out:
                continue
            v = None
            if self.area_fn:
                try:
                    v = self.clean(call(self.area_fn, img.copy(), cam, a, ts=ts, context=self.context))
                except Exception as e:
                    self.errors.append(f"{a['area_id']}/{ts} per-area fn: {e!r}")
            self.sources["per-area fn" if v is not None else "FALLBACK"] += 1
            out[a["area_id"]] = self.fallback if v is None else v
        return out

    def report(self):
        warm = sorted(self.seconds[1:]) or self.seconds
        if warm:
            print(f"{self.name}: {warm[len(warm) // 2]:.2f} s/image warm (median), first image "
                  f"{self.seconds[0]:.1f} s")
        print(f"{self.name}: {dict(self.sources)}")
        stats = getattr(self.mod, "STATS", None)  # optional module-level counters, e.g. compliance cascade
        if stats:
            print(f"{self.name}: STATS {dict(stats)}")
        for e in self.errors[:5]:
            print(f"  error: {e}")
        if len(self.errors) > 5:
            print(f"  ... {len(self.errors) - 5} more errors")


def resources():
    """'peak RAM ... | peak VRAM ...' for this process, as far as we can tell."""
    out = []
    try:
        import psutil
        mem = psutil.Process().memory_info()
        out.append(f"peak RAM {getattr(mem, 'peak_wset', mem.rss) / 2**30:.1f} GB")
    except Exception:
        pass
    torch = sys.modules.get("torch")
    if torch is not None and torch.cuda.is_available() and torch.cuda.is_initialized():
        out.append(f"peak VRAM {torch.cuda.max_memory_reserved() / 2**30:.1f} GB (PyTorch, this process)")
    return " | ".join(out) or "n/a"


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--images", default=str(IMAGES_DIR), help="image folder (<cam>/<ts>.jpg or flat)")
    ap.add_argument("--planogram", default=str(PLANOGRAM_PATH))
    ap.add_argument("--out", default=str(ROOT / "submission" / "output.json"))
    ap.add_argument("--stock-model", action="append",
                    help="stock model file; repeat it to average several models' probabilities "
                         "(default: models/onepass/onepass.py)")
    ap.add_argument("--compliance-model", default=str(ROOT / "models" / "onepass" / "onepass.py"))
    ap.add_argument("--cams", help="only these comma-separated camera ids (for debugging)")
    ap.add_argument("--empty-rule", choices=sorted(EMPTY_RULES), default=EMPTY_RULE,
                    help="planogram_compliant for areas predicted empty (default: %(default)s)")
    ap.add_argument("--expect-images", type=int, help="warn unless exactly this many photos are found (26 on the day)")
    ap.add_argument("--expect-areas", type=int, help="warn unless exactly this many areas are expected (289 on the day)")
    ap.add_argument("--same-day-context", choices=["off", CONTEXT_ON], default=CONTEXT_ON if SAME_DAY_CONTEXT else "off",
                    help="off (default) = single image, the only setting allowed for the submission; "
                         f"{CONTEXT_ON} lets the models use our other photos of the day and the timestamp")
    args = ap.parse_args()
    empty_override = EMPTY_RULES[args.empty_rule]
    context = args.same_day_context == CONTEXT_ON
    os.environ["SENSEI_SAME_DAY_CONTEXT"] = "1" if context else "0"  # before the models are imported
    if context:
        print("!" * 100)
        print("!! SAME-DAY CONTEXT ON: the models may use other photos of the day and the timestamp.")
        print("!! NOT ALLOWED FOR THE SUBMISSION (Sensei: only the image under analysis).")
        print("!" * 100)
    else:
        os.environ.setdefault("COMPLIANCE_CASCADE_TAU", "0")  # no same-area look-up of other photos
        os.environ.setdefault("COMPLIANCE_GROUPS", "0")
    mode = f"SAME-DAY CONTEXT ({CONTEXT_ON})" if context else "single image (submission mode)"

    t0 = time.time()
    planogram = load_planogram(args.planogram)
    try:
        images = list_images(args.images, args.planogram)
    except ValueError as e:
        sys.exit(f"ERROR {e}")
    if args.cams:
        images = [r for r in images if r.cam in set(args.cams.split(","))]
    n_areas = sum(len(planogram[r.cam]) for r in images)
    if args.expect_images is not None and len(images) != args.expect_images:
        print(f"WARN  found {len(images)} photos, expected {args.expect_images}: check the folder")
    if args.expect_areas is not None and n_areas != args.expect_areas:
        print(f"WARN  {n_areas} areas to predict, expected {args.expect_areas}: check the folder and the planogram")
    try:
        if not _curtain_refs():
            print("WARN  night-curtain look-up (log only) is off: our dataset not found (SENSEI_DATASET)")
    except Exception as e:
        print(f"WARN  night-curtain look-up (log only) is off ({e!r})")
    print(f"{len(images)} images from {len({r.cam for r in images})} cameras, {n_areas} areas to predict | {mode}"
          + ("" if context else f" | COMPLIANCE_CASCADE_TAU={os.environ['COMPLIANCE_CASCADE_TAU']} "
                                f"COMPLIANCE_GROUPS={os.environ['COMPLIANCE_GROUPS']}"))

    stock_paths = args.stock_model or [str(ROOT / "models" / "onepass" / "onepass.py")]
    stock_mods = [load_module(p) for p in stock_paths]
    comp_mod = load_module(args.compliance_model)
    warn_name_clashes(*stock_mods, comp_mod)
    for mod in (*stock_mods, comp_mod):
        if mod is not None and callable(getattr(mod, "prepare", None)):
            try:
                call(mod.prepare, images if context else None, context=context)
            except Exception:
                print(f"WARN  {mod.__name__}.prepare failed\n{traceback.format_exc()}")
    # stock tasks answer probabilities (None = no answer); combine_stock turns them into a level
    stocks = [Task(f"stock[{Path(p).stem}]", m, "predict_stock_image", "predict_stock", clean_stock, None, context)
              for p, m in zip(stock_paths, stock_mods)]
    comp = Task("compliance", comp_mod, "predict_compliant_image", "predict_compliant", clean_compliant,
                FALLBACK_COMPLIANT, context)
    t_startup = time.time() - t0

    sub = {}
    curtains, curtain_log, unreadable = [], [], []
    for i, rec in enumerate(images, 1):
        areas = planogram[rec.cam]
        try:
            img = load_image(rec.path)
        except Exception as e:
            try:  # a truncated JPEG still has most of its pixels
                ImageFile.LOAD_TRUNCATED_IMAGES = True
                img = load_image(rec.path)
                print(f"WARN  {rec.cam}/{rec.fname} is truncated ({e!r}); predicted from what could be read")
            except Exception as e2:
                print(f"WARN  {rec.cam}/{rec.fname} can't be read ({e2!r}): FALLBACK answers for its {len(areas)} areas")
                unreadable.append(len(areas))
                for a in areas:
                    submission.put(sub, rec.cam, rec.fname, a["area_id"], FALLBACK_COMPLIANT, FALLBACK_STOCK)
                continue
            finally:
                ImageFile.LOAD_TRUNCATED_IMAGES = False
        if img.size != IMAGE_SIZE:  # the planogram corners are in 1280x720 pixels
            print(f"WARN  {rec.cam}/{rec.fname} is {img.size[0]}x{img.size[1]}, resized to {IMAGE_SIZE[0]}x{IMAGE_SIZE[1]}")
            img = img.resize(IMAGE_SIZE, Image.BILINEAR)
        try:
            down, margin = curtain_down(img, rec.cam)
        except Exception as e:
            down, margin = False, 0.0
            print(f"WARN  curtain look-up failed on {rec.cam}/{rec.fname}: {e!r}")
        if down:  # log only: the answers below still come from the models
            curtain_log.append((rec.cam, rec.fname, margin))
        answers = [t.predict(img, rec.cam, areas, rec.ts) for t in stocks]
        c = comp.predict(img, rec.cam, areas, rec.ts)
        covered = set()  # second layer: areas the compliance model itself sees under the curtain
        explain = getattr(comp_mod, "explain_compliant_image", None)
        if rec.cam in CURTAIN_PHOTOS and callable(explain):
            try:
                ex = call(explain, img.copy(), rec.cam, areas, ts=rec.ts, context=context) or {}
                covered = {aid for aid, d in ex.items()
                           if isinstance(d, dict) and (d.get("covered") or d.get("stage") == "covered")}
            except Exception as e:
                print(f"WARN  explain_compliant_image failed on {rec.cam}/{rec.fname}: {e!r}")
        if covered:
            curtains.append(f"{rec.cam}/{rec.fname} areas {sorted(covered)} (compliance model)")
        for a in areas:
            aid = a["area_id"]
            if aid in covered:  # curtain: empty + compliant, exempt from the empty rule
                submission.put(sub, rec.cam, rec.fname, aid, True, 0)
                continue
            stock_value = combine_stock([ans[aid] for ans in answers])
            compliant = empty_override if empty_override is not None and stock_value == 0 else c[aid]
            submission.put(sub, rec.cam, rec.fname, aid, compliant, stock_value)
        if i % 20 == 0 or i == len(images):
            print(f"  {i}/{len(images)} images  ({time.time() - t0:.0f}s)")

    filled = submission.fill_missing(sub, images, FALLBACK_COMPLIANT, FALLBACK_STOCK, args.planogram)
    errors, warnings = submission.validate(sub, images, args.planogram)
    submission.write(sub, args.out)

    for t in (*stocks, comp):
        t.report()
    if curtains:
        print(f"covered (compliance model) -> empty + compliant: {', '.join(curtains)}")
    for cam, fname, margin in curtain_log:
        got = Counter((e["stock_level"], e["planogram_compliant"]) for e in sub[cam][fname].values())
        print(f"curtain look-up (log only): {cam}/{fname} looks like our curtain photo (margin {margin:+.2f}); "
              f"the model answered {dict(got)}")
    per_img = sorted(sum(secs) for secs in zip(*(t.seconds[1:] for t in (*stocks, comp))))
    if per_img:
        print(f"cost: startup (imports, model load, prepare) {t_startup:.1f} s | "
              f"{per_img[len(per_img) // 2]:.2f} s/image warm (median, all models) | {resources()}")
    entries = [e for imgs in sub.values() for areas in imgs.values() for e in areas.values()]
    print("stock levels:", dict(Counter(e["stock_level"] for e in entries)),
          "| compliant:", dict(Counter(e["planogram_compliant"] for e in entries)))
    for w in warnings:
        print("WARN ", w)
    for e in errors:
        print("ERROR", e)
    # answers that came from a fallback (model missing or failing), not from a model: never send those unknowingly
    n_fallback = sum(t.sources["FALLBACK"] for t in (*stocks, comp)) + filled + 2 * sum(unreadable)
    if n_fallback:
        print(f"!! {n_fallback} answers are FALLBACKS (a model is missing or failed, see the errors above). "
              "Fix that before sending this file.")
    status = "INVALID" if errors else "FALLBACKS" if n_fallback else "OK"
    print(f"{status}: {len(entries)} areas -> {args.out}"
          f"{f' ({filled} filled by safety net)' if filled else ''}  [{time.time() - t0:.0f}s]  {mode}")
    sys.exit(1 if errors else 2 if n_fallback else 0)


if __name__ == "__main__":
    main()
