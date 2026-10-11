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

--stock-tilt K (opt-in, off by default; supervised model only): "lower when unsure". p(full) is multiplied by K
(0 < K <= 1) before the best-expected-points level is chosen, so "full" needs more confidence; empty vs half is
unchanged. Off (no flag, or K = 1) gives exactly the default answers. The last line then names it:
"OK (stock tilt k=0.7): ...".
--p-stock-out PATH (checks only, off by default): also writes the answers plus each area's averaged p_stock (before
the tilt) to PATH, e.g. to check the tilt or feed `sensei combine`. --out is unchanged; never send PATH.
--stock-model mix is the DEFAULT (André's choice, 11 Oct; supervised model only): R3 retrained with -38's label mix
(stock heads on 0.75 x our label + 0.125 x each Sensei-wording AI pass, lab/silver2; product head on our labels). Its
weights tag and its own block-8 stock head are set together (ONEPASS_TAG, ONEPASS_B8_HEAD), unless those env vars are
set by hand. --stock-model ld6ee runs the model before it. Not with --stock-tilt (that combination was never
validated): the tilt needs --stock-model ld6ee. The last line names the model: "OK (stock model mix): ...".
"""
import argparse
import hashlib
import importlib.util
import json
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
from common.data import _curtain_refs, camera_drift  # noqa: E402
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
DRIFT_WARN_PX = 10  # warn when a photo's view is shifted more than this against our photos of the camera
CONTEXT_ON = "on-NOT-FOR-SUBMISSION"
# --stock-model presets: (one-pass weights tag in models/stock_4e/deploy/, its block-8 stock head), set together for the
# one-pass adapter, which gives both answers in one pass. ld6ee = the default (what the adapter loads without env).
STOCK_PRESETS = {"ld6ee": ("ld6ee", "models/onepass/deploy/stockb8.npz"),
                 "mix": ("ld6ee_mix", "models/onepass/deploy/stockb8_ld6ee_mix.npz")}
# The preset the plain command runs (no --stock-model preset, no --label-free, ONEPASS_TAG / ONEPASS_B8_HEAD unset):
# André's choice of 11 Oct. --stock-model ld6ee gives the model before it.
DEFAULT_STOCK_MODEL = "mix"


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


def average_stock(answers):
    """Mean of the models' stock probabilities {0: p, 0.5: p, 1: p} (None = that model had no answer); None if
    no model answered."""
    ps = [p for p in answers if p is not None]
    return {lv: sum(p.get(lv, 0.0) for p in ps) / len(ps) for lv in (0, 0.5, 1)} if ps else None


def combine_stock(answers, tilt=None):
    """Average the stock probabilities of several models (None = that model had no answer) and pick the
    level with the best expected points; FALLBACK_STOCK if no model answered. tilt (--stock-tilt, None = off)
    multiplies p(full) by k first (not renormalised: that would not change the choice)."""
    q = average_stock(answers)
    if q is None:
        return FALLBACK_STOCK
    if tilt is not None:
        q[1] *= tilt
    return submission.best_stock(q)


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


def label_free_checks(images, allow_overlap):
    """--label-free: the setup must have run, and no photo being predicted may be one the baselines were built from."""
    deploy = Path(os.environ.get("LABELFREE_DEPLOY") or ROOT / "models" / "compliance" / "deploy")
    weights = Path(os.environ.get("LABELFREE_WEIGHTS") or deploy / "siglip2b_vision_fp16.pt")
    if not weights.exists():
        sys.exit(f"ERROR label-free weights missing ({weights}): run `python -I {ROOT / 'labelfree_setup.py'} weights` "
                 "once with internet (downloads google/siglip2-base-patch16-224, 1.5 GB), then predict offline")
    custom = os.environ.get("LABELFREE_BASELINES")
    if custom:
        sources = Path(custom).with_name(Path(custom).stem + ".sources.json")
    else:
        sources = ROOT / "models" / "labelfree" / "deploy" / "shipped_baselines.sources.json"
    if not sources.exists():
        sys.exit(f"ERROR {sources} not found: can't prove the label-free baselines don't come from these photos")
    used = {e["md5"]: e["photo"] for e in json.loads(sources.read_text(encoding="utf-8"))["photos"]}
    overlap = [f"{r.cam}/{r.fname}" for r in images if hashlib.md5(Path(r.path).read_bytes()).hexdigest() in used]
    if overlap and not allow_overlap:
        sys.exit(f"ERROR {len(overlap)} photos to predict were used to build the label-free baselines (e.g. "
                 f"{overlap[:3]}): the baselines must come from other photos. Evaluation only: --allow-baseline-overlap")
    if overlap:
        print(f"WARN  {len(overlap)} photos were used to build the label-free baselines; allowed for evaluation only, "
              "NOT FOR THE SUBMISSION")


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
                         "(default: models/onepass/onepass.py), or a preset of the one-pass model: 'mix' (the "
                         "default) = R3 retrained with -38's label mix, 0.75 ours + 0.25 AI passes; 'ld6ee' = the model "
                         "before it")
    ap.add_argument("--compliance-model", help="compliance model file (default: models/onepass/onepass.py, or the "
                                               "label-free adapter with --label-free)")
    ap.add_argument("--label-free", action="store_true",
                    help="zero-label mode (pitch / new-store path): SigLIP2 zero-shot product + floor-share stock; "
                         "run `labelfree_setup.py weights` once with internet first")
    ap.add_argument("--allow-baseline-overlap", action="store_true",
                    help="evaluation only: predict photos the label-free baselines were built from (NOT for the submission)")
    ap.add_argument("--cams", help="only these comma-separated camera ids (for debugging)")
    ap.add_argument("--stock-tilt", type=float, metavar="K",
                    help="opt-in, off by default: multiply p(full) by K (0 < K <= 1) before choosing the stock level, "
                         "so 'full' needs more confidence (supervised model only)")
    ap.add_argument("--p-stock-out", metavar="PATH",
                    help="checks only, off by default: also write PATH = the same answers plus p_stock [p_empty, p_half, "
                         "p_full] per area (the averaged probabilities, before any --stock-tilt; null where no model "
                         "answered). --out is unchanged. Never send PATH")
    ap.add_argument("--empty-rule", choices=sorted(EMPTY_RULES), default=EMPTY_RULE,
                    help="planogram_compliant for areas predicted empty (default: %(default)s)")
    ap.add_argument("--expect-images", type=int, help="warn unless exactly this many photos are found (26 on the day)")
    ap.add_argument("--expect-areas", type=int, help="warn unless exactly this many areas are expected (289 on the day)")
    ap.add_argument("--same-day-context", choices=["off", CONTEXT_ON], default=CONTEXT_ON if SAME_DAY_CONTEXT else "off",
                    help="off (default) = single image, the only setting allowed for the submission; "
                         f"{CONTEXT_ON} lets the models use our other photos of the day and the timestamp")
    args = ap.parse_args()
    if args.stock_tilt is not None:
        if not 0 < args.stock_tilt <= 1:
            ap.error(f"--stock-tilt must be in (0, 1], got {args.stock_tilt}")
        if args.label_free:
            ap.error("--stock-tilt is for the supervised model only, not for --label-free")
    tilt = None if args.stock_tilt in (None, 1.0) else args.stock_tilt
    if args.p_stock_out and Path(args.p_stock_out).resolve() == Path(args.out).resolve():
        ap.error("--p-stock-out must be another file than --out")
    preset = None  # --stock-model mix / ld6ee: weights tag + block-8 head of the one-pass model, set together
    if args.stock_model and any(m in STOCK_PRESETS for m in args.stock_model):
        if len(args.stock_model) > 1:
            ap.error(f"--stock-model {'/'.join(STOCK_PRESETS)} can't be combined with other --stock-model values")
        if args.label_free:
            ap.error("--stock-model presets are for the supervised model only, not for --label-free")
        preset, args.stock_model = args.stock_model[0], None
    elif not args.label_free and not (os.environ.get("ONEPASS_TAG") or os.environ.get("ONEPASS_B8_HEAD")):
        preset = DEFAULT_STOCK_MODEL  # the plain command runs the chosen model
    if preset is not None:
        tag, head = STOCK_PRESETS[preset]
        stem = ROOT / "models" / "stock_4e" / "deploy" / f"onepass_s{os.environ.get('ONEPASS_SIZE', '224')}_{tag}"
        missing = [str(f) for f in (Path(f"{stem}.pt"), Path(f"{stem}.json"), Path(f"{stem}_product.npz"), ROOT / head)
                   if not f.exists()]
        if missing:
            sys.exit(f"ERROR --stock-model {preset}: missing {', '.join(missing)}")
        for k, v in (("ONEPASS_TAG", tag), ("ONEPASS_B8_HEAD", str(ROOT / head))):
            if os.environ.get(k, v) != v:
                print(f"WARN  --stock-model {preset} replaces {k}={os.environ[k]} with {v}")
            os.environ[k] = v  # read by models/onepass/onepass.py when the model is built
    if preset not in (None, "ld6ee") and tilt is not None:
        ap.error(f"--stock-model {preset} with --stock-tilt was never validated: use one or the other (the tilt runs "
                 "with --stock-model ld6ee --stock-tilt K)")
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
    if args.label_free:
        mode = "LABEL-FREE mode (zero labels; pitch / new-store path, NOT the submission model)"
    if preset not in (None, "ld6ee"):
        mode += f" | stock model {preset}"
        print(f"stock model {preset}{' (the default)' if preset == DEFAULT_STOCK_MODEL else ''}: one-pass weights "
              f"{STOCK_PRESETS[preset][0]} + block-8 head {STOCK_PRESETS[preset][1]}; both answers come from this model")
    if tilt is not None:
        mode += f" | stock tilt k={tilt:g}"
        print(f"stock tilt k={tilt:g} (opt-in): p(full) x {tilt:g} before the best-expected-points level, so 'full' "
              "needs more confidence")

    t0 = time.time()
    planogram = load_planogram(args.planogram)
    skipped = []  # photos found but not predicted (unknown camera, unreadable, unsupported format)
    try:
        images = list_images(args.images, args.planogram, skipped=skipped)
    except ValueError as e:
        sys.exit(f"ERROR {e}")
    count_problems = []
    if args.cams:
        images = [r for r in images if r.cam in set(args.cams.split(","))]
    n_areas = sum(len(planogram[r.cam]) for r in images)
    if args.expect_images is not None and len(images) != args.expect_images:
        count_problems.append(f"{len(images)} photos, expected {args.expect_images}")
        print(f"WARN  found {len(images)} photos, expected {args.expect_images}: check the folder")
    if args.expect_areas is not None and n_areas != args.expect_areas:
        count_problems.append(f"{n_areas} areas, expected {args.expect_areas}")
        print(f"WARN  {n_areas} areas to predict, expected {args.expect_areas}: check the folder and the planogram")
    if skipped:
        count_problems.append(f"{len(skipped)} files NOT predicted")
    try:
        if not _curtain_refs():
            print("WARN  night-curtain look-up (log only) is off: our dataset not found (SENSEI_DATASET)")
    except Exception as e:
        print(f"WARN  night-curtain look-up (log only) is off ({e!r})")
    print(f"{len(images)} images from {len({r.cam for r in images})} cameras, {n_areas} areas to predict | {mode}"
          + ("" if context else f" | COMPLIANCE_CASCADE_TAU={os.environ['COMPLIANCE_CASCADE_TAU']} "
                                f"COMPLIANCE_GROUPS={os.environ['COMPLIANCE_GROUPS']}"))

    default_model = ROOT / "models" / ("labelfree/labelfree.py" if args.label_free else "onepass/onepass.py")
    if args.label_free:
        label_free_checks(images, args.allow_baseline_overlap)
    args.compliance_model = args.compliance_model or str(default_model)
    stock_paths = args.stock_model or [str(default_model)]
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
    p_rows = {} if args.p_stock_out else None  # (cam, fname, area_id) -> averaged p_stock, for --p-stock-out
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
        if img.size != IMAGE_SIZE:  # the planogram corners are in 1280x720 pixels: same as rescaling the polygons
            print(f"WARN  {rec.cam}/{rec.fname} is {img.size[0]}x{img.size[1]}, not {IMAGE_SIZE[0]}x{IMAGE_SIZE[1]}: "
                  "resized so the planogram polygons fit (check the photo)")
            img = img.resize(IMAGE_SIZE, Image.BILINEAR)
        try:
            down, margin = curtain_down(img, rec.cam)
        except Exception as e:
            down, margin = False, 0.0
            print(f"WARN  curtain look-up failed on {rec.cam}/{rec.fname}: {e!r}")
        if down:  # log only: the answers below still come from the models
            curtain_log.append((rec.cam, rec.fname, margin))
        else:
            try:  # warn-only: has the camera moved since our photos? (answers never depend on it)
                d = camera_drift(img, rec.cam)
                if d is not None and d[0] > DRIFT_WARN_PX:
                    print(f"WARN  {rec.cam}/{rec.fname}: the view is shifted ~{d[0]:.0f} px against our photos of this "
                          f"camera (response {d[1]:.2f}): check that the planogram polygons still sit on the crates")
            except Exception as e:
                print(f"WARN  drift check failed on {rec.cam}/{rec.fname}: {e!r}")
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
            stock_value = combine_stock([ans[aid] for ans in answers], tilt)
            if p_rows is not None:
                q = average_stock([ans[aid] for ans in answers])
                p_rows[(str(rec.cam), rec.fname, aid)] = None if q is None else [q[0], q[0.5], q[1]]
            compliant = empty_override if empty_override is not None and stock_value == 0 else c[aid]
            submission.put(sub, rec.cam, rec.fname, aid, compliant, stock_value)
        if i % 20 == 0 or i == len(images):
            print(f"  {i}/{len(images)} images  ({time.time() - t0:.0f}s)")

    filled = submission.fill_missing(sub, images, FALLBACK_COMPLIANT, FALLBACK_STOCK, args.planogram)
    errors, warnings = submission.validate(sub, images, args.planogram)
    submission.write(sub, args.out)
    if p_rows is not None:
        rows = {cam: {f: {aid: {**e, "p_stock": p_rows.get((cam, f, aid))} for aid, e in areas.items()}
                      for f, areas in imgs.items()} for cam, imgs in sub.items()}
        Path(args.p_stock_out).parent.mkdir(parents=True, exist_ok=True)
        Path(args.p_stock_out).write_text(json.dumps(rows, indent=1), encoding="utf-8")
        print(f"p_stock next to each answer -> {args.p_stock_out} ({sum(v is not None for v in p_rows.values())} "
              "areas; for checks only, never send this file)")

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
    if count_problems:
        print(f"!! INCOMPLETE: {'; '.join(count_problems)} (see the WARN lines above). Check before sending this file.")
    status = "INVALID" if errors else "FALLBACKS" if n_fallback else "INCOMPLETE" if count_problems else "OK"
    notes = ([f"stock model {preset}"] if preset not in (None, "ld6ee") else []) + (
        [f"stock tilt k={tilt:g}"] if tilt is not None else [])
    if notes:
        status += f" ({', '.join(notes)})"
    print(f"{status}: {len(entries)} areas -> {args.out}"
          f"{f' ({filled} filled by safety net)' if filled else ''}  [{time.time() - t0:.0f}s]  {mode}")
    sys.exit(1 if errors else 2 if n_fallback else 3 if count_problems else 0)


if __name__ == "__main__":
    main()
