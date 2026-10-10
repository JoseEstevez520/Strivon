"""Reproducible train / predict command for the image-only Strivon model (lane I).

  python lab/predict.py train --model ensemble --out lab/models/lane_i_ens.pkl [--exclude lab/frozen_test.json | --exclude-fold K]
  python lab/predict.py train --out lab/models/lane_i.pkl            (older x01 blend + p01 model, --model x01)
  python lab/predict.py predict --images DIR --model lab/models/lane_i.pkl --out preds.json [--threads 2]
                               [--timing t.json] [--features f.npz]

train reads the answer key eval/benchmark/labels_v1.json (labelled photos only), computes every feature from the raw
photos in data/images and saves one pickle with the weights, the geometry (planogram quads, crate quads) and the HSV bank.
predict reads DIR/<camera>/<timestamp>.jpg and writes {cam: {img: {area_id: {planogram_compliant, stock_level,
stock_value}}}} for every planogram area of each photographed camera. Each photo is predicted from its own pixels only.
It exits non-zero with a message if a camera is unknown, an image cannot be read, an area is missing or a value is NaN.
Models: --model x01 = x01 blend + p01 HSV compliance (predict_lib.py); --model ensemble = weighted h01d + r01b + fine-tuned
MobileNetV3 stock with p01 + v01 planogram-family compliance (predict_lib_ens.py, port of exp_e01_wcv3.py + exp_v01_family.py).
predict reads the model kind from the model file.
"""
import os
import sys
import time

T_START = time.perf_counter()


def _threads(argv):
    n = "2"
    if "--threads" in argv:
        n = argv[argv.index("--threads") + 1]
    for k in ("OMP_NUM_THREADS", "OPENBLAS_NUM_THREADS", "MKL_NUM_THREADS", "NUMEXPR_NUM_THREADS"):
        os.environ[k] = n
    return int(n)


NTHREADS = _threads(sys.argv)

import argparse  # noqa: E402
import json  # noqa: E402
import pickle  # noqa: E402

import cv2  # noqa: E402

cv2.setNumThreads(NTHREADS)
import numpy as np  # noqa: E402

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
sys.path.insert(0, HERE)
import predict_lib as P  # noqa: E402

T_IMPORTS = time.perf_counter()


def die(msg):
    print(f"predict.py: ERROR: {msg}", file=sys.stderr)
    sys.exit(2)


def train(a):
    if a.model == "ensemble":
        return train_ens(a)
    key = json.load(open(a.labels))
    folds = json.load(open(a.folds))
    excl = set()
    if a.exclude:
        excl = {(c, i) for c, imgs in json.load(open(a.exclude)).items() for i in imgs}
    geo = P.load_geo(a.planogram)
    Xs, Hs, ys, ncs, cams, aids, fl, photos = [], [], [], [], [], [], [], []
    for cam in sorted(key):
        for img in sorted(key[cam]):
            if (cam, img) in excl or (a.exclude_fold is not None and folds[f"{cam}/{img}"] == a.exclude_fold):
                continue
            areas = key[cam][img]
            im = cv2.imread(os.path.join(a.images, cam, img))
            if im is None:
                die(f"cannot read {cam}/{img}")
            ids = sorted(areas)
            X, H = P.photo_features(im, ids, geo)
            Xs.append(X); Hs.append(H); aids += ids; cams += [cam] * len(ids)
            ys += [P.E.LEVELS.index(areas[i]["stock_level"]) for i in ids]
            ncs += [not areas[i]["planogram_compliant"] for i in ids]
            fl += [folds[f"{cam}/{img}"]] * len(ids)
            photos.append(f"{cam}/{img}")
    X, H = np.concatenate(Xs), np.concatenate(Hs)
    if not np.isfinite(X).all() or not np.isfinite(H).all():
        die("NaN in training features")
    stock = P.fit_stock(X, np.array(ys), np.array(cams))
    comp = P.fit_compliance(H, aids, ncs, fl)
    model = dict(version="lane_i_v1", stock=stock, comp=comp, geo=geo, n_stock=X.shape[1],
                 image_shape=im.shape, photos=photos, n_rows=len(ys))
    os.makedirs(os.path.dirname(os.path.abspath(a.out)), exist_ok=True)
    pickle.dump(model, open(a.out, "wb"))
    print(f"trained on {len(photos)} photos, {len(ys)} areas, logistic C={stock['C']}, "
          f"{int(np.sum(ncs))} non-compliant areas in the bank -> {a.out} ({os.path.getsize(a.out) / 1024:.0f} KiB)")


def train_ens(a):
    """Rows in run5 order: sorted camera, sorted image, planogram area order, labelled areas only."""
    os.environ.setdefault("HF_HUB_OFFLINE", "1")
    import predict_lib_ens as PE
    key = json.load(open(a.labels))
    folds = json.load(open(a.folds))
    excl = set()
    if a.exclude:
        excl = {(c, i) for c, imgs in json.load(open(a.exclude)).items() for i in imgs}
    geo = P.load_geo(a.planogram)
    names = PE.planogram_names(a.planogram)
    cols = {k: [] for k in ("Xb", "Xh", "G", "Hr", "Hsv", "U8", "aid", "cam", "own", "grp", "lvl", "ok", "fold")}
    photos = []
    t = P.Timer()
    for cam in sorted(key):
        for img in sorted(key[cam]):
            if (cam, img) in excl or (a.exclude_fold is not None and folds[f"{cam}/{img}"] == a.exclude_fold):
                continue
            areas = key[cam][img]
            ids = [x for x in P.cam_areas(geo["quads"], cam) if x in areas]
            if set(ids) != set(areas):
                die(f"{cam}/{img}: labelled areas not in the planogram: {sorted(set(areas) - set(ids))}")
            im = cv2.imread(os.path.join(a.images, cam, img))
            if im is None:
                die(f"cannot read {cam}/{img}")
            D = PE.photo_feats(im, ids, geo, t, wb=not a.no_wb)
            for k in ("Xb", "Xh", "G", "Hr", "Hsv", "U8"):
                cols[k].append(D[k])
            n = len(ids)
            cols["aid"] += ids; cols["cam"] += [cam] * n; cols["own"] += [cam + img] * n; cols["grp"] += [f"{cam}|{img}"] * n
            cols["lvl"] += [areas[i]["stock_level"] for i in ids]; cols["ok"] += [bool(areas[i]["planogram_compliant"]) for i in ids]
            cols["fold"] += [folds[f"{cam}/{img}"]] * n
            photos.append(f"{cam}/{img}")
    D = {k: (np.concatenate(v) if k in ("Xb", "Xh", "G", "Hr", "Hsv", "U8") else np.array(v)) for k, v in cols.items()}
    for k in ("Xb", "Xh", "G", "Hr", "Hsv"):
        if not np.isfinite(D[k]).all():
            die(f"NaN in training features {k}")
    print(f"features of {len(photos)} photos, {len(D['aid'])} areas", file=sys.stderr, flush=True)
    ens = PE.train_ensemble(D, geo, names, NTHREADS, log=lambda m: print(m, file=sys.stderr, flush=True), wb=not a.no_wb)
    model = dict(version="lane_i_ens_v1", ens=ens, geo=geo, n_stock=D["Xb"].shape[1], image_shape=im.shape, photos=photos,
                 n_rows=len(D["aid"]))
    os.makedirs(os.path.dirname(os.path.abspath(a.out)), exist_ok=True)
    pickle.dump(model, open(a.out, "wb"))
    print(f"trained ensemble on {len(photos)} photos, {len(D['aid'])} areas, weights "
          f"{dict(zip(PE.E01_MEMBERS, np.round(ens['weights'], 2).tolist()))} -> {a.out} ({os.path.getsize(a.out) / 1024:.0f} KiB)")


def predict(a):
    model = pickle.load(open(a.model, "rb"))
    geo = model["geo"]
    rt, t_torch = None, 0.0
    if model["version"].startswith("lane_i_ens"):
        t0 = time.perf_counter()
        import torch  # noqa: F401
        import timm  # noqa: F401
        import predict_lib_ens as PE
        t_torch = time.perf_counter() - t0
        rt = PE.Runtime(model["ens"], geo, NTHREADS)
    pq = P.planogram_quads(a.planogram)
    T_LOAD = time.perf_counter()
    if not os.path.isdir(a.images):
        die(f"no such folder {a.images}")
    jobs = []
    for cam in sorted(os.listdir(a.images)):
        d = os.path.join(a.images, cam)
        if not os.path.isdir(d):
            continue
        aids = P.cam_areas(pq, cam)
        if not aids:
            die(f"camera {cam} has no areas in {a.planogram}")
        for aid in aids:
            if aid not in geo["quads"] or aid not in geo["a2c"] or not np.allclose(geo["quads"][aid], pq[aid]):
                die(f"area {aid} of the planogram is not in the model geometry (or its quad changed); retrain")
        for f in sorted(os.listdir(d)):
            if f.lower().endswith((".jpg", ".jpeg")):
                jobs.append((cam, f, aids))
    if not jobs:
        die(f"no JPEG photos under {a.images}/<camera>/")
    out, timing, feats = {}, [], {}
    for cam, img, aids in jobs:
        t = P.Timer()
        with t("decode"):
            im = cv2.imread(os.path.join(a.images, cam, img))
        if im is None:
            die(f"cannot read image {cam}/{img}")
        if im.shape != tuple(model["image_shape"]):
            die(f"{cam}/{img} is {im.shape}, the planogram coordinates are for {tuple(model['image_shape'])}")
        if rt is not None:
            lv, ok, Pr, Pm, fin = rt.predict_photo(im, cam, aids, t)
            if not fin:
                die(f"NaN in the features of {cam}/{img}")
            X, H = Pm, None
        else:
            X, H = P.photo_features(im, aids, geo, t)
            if X.shape != (len(aids), model["n_stock"]) or not np.isfinite(X).all() or not np.isfinite(H).all():
                die(f"NaN or bad shape in the features of {cam}/{img}")
            with t("stock"):
                Pr = P.stock_proba(model["stock"], X)
                lv = [P.E.decide(p) for p in Pr]
            with t("comp"):
                ok = P.compliant(model["comp"], H, aids)
        if not np.isfinite(Pr).all():
            die(f"NaN stock probability in {cam}/{img}")
        out.setdefault(cam, {})[img] = {aid: dict(planogram_compliant=bool(c), stock_level=l, stock_value=P.VAL[l])
                                        for aid, l, c in zip(aids, lv, ok)}
        timing.append(dict(photo=f"{cam}/{img}", areas=len(aids), wall=t.wall, cpu=t.cpu))
        if a.features:
            feats[f"{cam}/{img}"] = (aids, X, H, Pr)
    for cam, imgs in out.items():
        need = set(P.cam_areas(pq, cam))
        for img, areas in imgs.items():
            if set(areas) != need:
                die(f"{cam}/{img}: missing areas {sorted(need - set(areas))}")
    json.dump(out, open(a.out, "w"), indent=1)
    T_END = time.perf_counter()
    if a.timing:
        json.dump(dict(imports=T_IMPORTS - T_START, load=T_LOAD - T_IMPORTS, torch_import=t_torch, total=T_END - T_START,
                       cpu_total=time.process_time(), threads=NTHREADS, photos=timing), open(a.timing, "w"), indent=1)
    if a.features:
        pickle.dump(feats, open(a.features, "wb"))
    n = sum(len(v) for v in out.values())
    print(f"{n} photos, {sum(len(x) for v in out.values() for x in v.values())} areas -> {a.out} "
          f"({T_END - T_START:.2f} s after interpreter start)")


def main():
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    sub = ap.add_subparsers(dest="cmd", required=True)
    tr = sub.add_parser("train")
    tr.add_argument("--out", required=True)
    tr.add_argument("--labels", default=os.path.join(ROOT, "eval/benchmark/labels_v1.json"))
    tr.add_argument("--folds", default=os.path.join(ROOT, "eval/benchmark/folds.json"),
                    help="benchmark folds, used for the inner split of the compliance logistic")
    tr.add_argument("--images", default=os.path.join(ROOT, "data/images"))
    tr.add_argument("--exclude", help="JSON {cam: [img, ...]} of photos to leave out (e.g. lab/frozen_test.json)")
    tr.add_argument("--exclude-fold", type=int, help="leave out one benchmark fold")
    tr.add_argument("--model", choices=["x01", "ensemble"], default="x01", help="which model to train (default x01)")
    tr.add_argument("--no-wb", action="store_true", help="ensemble: compliance histograms without the gray-world gains "
                    "(exp_v01_family instead of exp_rb01_wbcomp)")
    pr = sub.add_parser("predict")
    pr.add_argument("--images", required=True)
    pr.add_argument("--model", required=True)
    pr.add_argument("--out", required=True)
    pr.add_argument("--timing", help="write per-photo stage times (wall and CPU seconds) here")
    pr.add_argument("--features", help="write the computed features here (pickle, for the parity check)")
    for p in (tr, pr):
        p.add_argument("--threads", type=int, default=2)
        p.add_argument("--planogram", default=os.path.join(ROOT, "data/planogram.json"))
    a = ap.parse_args()
    (train if a.cmd == "train" else predict)(a)


if __name__ == "__main__":
    main()
