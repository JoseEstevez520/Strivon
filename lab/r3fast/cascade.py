"""Cascade prototype: the cheap lab model answers every area, R3 (agents/, one DINOv2-S pass) re-answers only the
areas where the lab is unsure.

Hypothesis: R3's per-photo cost is almost all the DINOv2 forward, which is per crop (one 224 px crop per area, no
cross-area interaction: LayerNorm per token, no BatchNorm, heads per row). So running R3 on the ~30-46% of areas where
max(lab p_stock) < tau should cost about that share of R3's CPU while giving R3's stock answers on those areas, and
the lab's (often equal) answers elsewhere.

  python lab/r3fast/cascade.py run --images DIR --planogram P --lab-model M --agents AGENTS_DIR --tau 0.9 \
         --comp lab|r3 --out preds.json [--timing t.json]
  python lab/r3fast/cascade.py profile --images DIR --planogram P --agents AGENTS_DIR   (fixed vs per-crop cost)

--comp r3 keeps the shipped compliance answer (R3's product head on every area), which needs the DINOv2 pass on
every crop, so it saves nothing; --comp lab takes compliance from the lab model on the areas R3 does not see.
R3's model code is imported from AGENTS_DIR as a library (models/stock_4e/onepass_infer.py, the deployed weights and
the same block-8 stock head the onepass adapter loads by default); nothing there is edited.
Single image only: every answer uses the pixels of its own photo.
"""
import argparse
import json
import os
import subprocess
import sys
import tempfile
import time
from pathlib import Path

HERE = Path(__file__).resolve().parent
LAB = HERE.parent


def load_r3(agents, threads):
    agents = Path(agents).resolve()
    sys.path.insert(0, str(agents))
    sys.path.insert(0, str(agents / "models" / "stock_4e"))
    import torch  # noqa: F401
    from onepass_infer import OnePass
    from common import load_image, load_planogram, IMAGE_SIZE, submission
    tag = os.environ.get("ONEPASS_TAG", "ld6ee")
    b8 = agents / "models" / "onepass" / "deploy" / f"stockb8_{tag}.npz"
    if not b8.exists():
        b8 = agents / "models" / "onepass" / "deploy" / "stockb8.npz"
    m = OnePass(size=224, device="cpu", threads=threads, tag=tag, b8_stock=str(b8))
    return m, load_image, load_planogram, IMAGE_SIZE, submission


def photos(images):
    out = []
    for cam in sorted(os.listdir(images)):
        d = os.path.join(images, cam)
        if os.path.isdir(d):
            out += [(cam, f) for f in sorted(os.listdir(d)) if f.lower().endswith((".jpg", ".jpeg"))]
    return out


def run(a):
    t0, c0 = time.perf_counter(), time.process_time()
    # 1. lab model on every area (its own process, single thread), with p_stock
    with tempfile.TemporaryDirectory(dir=a.tmp) as td:
        lab_out, lab_t = os.path.join(td, "lab.json"), os.path.join(td, "lab_t.json")
        subprocess.run([sys.executable, str(LAB / "predict_fast.py"), "predict", "--images", a.images, "--model",
                        a.lab_model, "--planogram", a.planogram, "--out", lab_out, "--p-stock", "--threads",
                        str(a.threads), "--timing", lab_t], check=True, stdout=subprocess.DEVNULL)
        L, LT = json.load(open(lab_out)), json.load(open(lab_t))
    t_lab = time.perf_counter() - t0
    lab_cpu_children = os.times().children_user + os.times().children_system
    # 2. R3 on the unsure areas
    c1 = time.process_time()
    m, load_image, load_planogram, IMAGE_SIZE, submission = load_r3(a.agents, a.threads)
    pg = load_planogram(a.planogram)
    r3_startup_cpu = time.process_time() - c1
    sub, per_photo, n_all, n_r3 = {}, [], 0, 0
    for cam, fname in photos(a.images):
        areas = pg[cam]
        lab = L[cam][fname]
        if a.comp == "r3":
            unsure = list(areas)
        else:
            unsure = [ar for ar in areas if max(lab[ar["area_id"]]["p_stock"]) < a.tau]
        cp = time.process_time()
        r3 = {}
        if unsure:
            img = load_image(os.path.join(a.images, cam, fname))
            if img.size != IMAGE_SIZE:
                img = img.resize(IMAGE_SIZE)
            r3 = m.predict(img, unsure)
        r3_cpu = time.process_time() - cp
        lab_photo = dict(next(p for p in LT["photos"] if p["photo"] == f"{cam}/{fname}"))
        lab_photo["cpu"] = sum(lab_photo["cpu"].values())  # decode + features + heads of this photo
        for ar in areas:
            aid = ar["area_id"]
            go = aid in r3 and max(lab[aid]["p_stock"]) < a.tau
            if go:  # same rule as agents/predict.py with one stock model: best expected points of R3's p_stock
                stock = submission.best_stock(dict(zip((0, 0.5, 1), r3[aid]["p_stock"])))
            else:
                stock = lab[aid]["stock_value"]
            comp = r3[aid]["compliant"] if aid in r3 else lab[aid]["planogram_compliant"]
            submission.put(sub, cam, fname, aid, comp, stock)
            e = sub[cam][fname][aid]
            e["source"] = "r3" if go else "lab"
            if aid in r3:
                e["p_stock_r3"] = r3[aid]["p_stock"]
        n_all += len(areas)
        n_r3 += len(unsure)
        per_photo.append(dict(photo=f"{cam}/{fname}", areas=len(areas), r3_areas=len(unsure),
                              lab_cpu=lab_photo["cpu"], r3_cpu=r3_cpu, cpu=lab_photo["cpu"] + r3_cpu))
    Path(a.out).parent.mkdir(parents=True, exist_ok=True)
    json.dump(sub, open(a.out, "w"), indent=1)
    lab_cpu_children = os.times().children_user + os.times().children_system
    tot = dict(tau=a.tau, comp=a.comp, photos=len(per_photo), areas=n_all, r3_areas=n_r3,
               r3_share=round(n_r3 / max(1, n_all), 3),
               cpu_per_photo_mean=round(sum(p["cpu"] for p in per_photo) / len(per_photo), 3),
               lab_cpu_per_photo=round(sum(p["lab_cpu"] for p in per_photo) / len(per_photo), 3),
               r3_cpu_per_photo=round(sum(p["r3_cpu"] for p in per_photo) / len(per_photo), 3),
               r3_startup_cpu=round(r3_startup_cpu, 2), lab_process_cpu=round(lab_cpu_children, 2),
               lab_wall=round(t_lab, 2), total_cpu_incl_startup=round(time.process_time() - c0 + lab_cpu_children, 2),
               wall=round(time.perf_counter() - t0, 2))
    print(json.dumps(tot))
    if a.timing:
        json.dump(dict(total=tot, photos=per_photo), open(a.timing, "w"), indent=1)


def profile(a):
    """Split R3's per-photo CPU into decode, crops (rectify, per area) and the DINOv2 forward for k crops."""
    import numpy as np
    import torch
    m, load_image, load_planogram, IMAGE_SIZE, submission = load_r3(a.agents, a.threads)
    pg = load_planogram(a.planogram)
    rows = []
    for cam, fname in photos(a.images)[: a.n]:
        areas = pg[cam]
        c = time.process_time()
        img = load_image(os.path.join(a.images, cam, fname))
        dec = time.process_time() - c
        c = time.process_time()
        x = m.crops(img, areas)
        crop = time.process_time() - c
        for k in sorted({1, 2, 4, 8, len(areas)}):
            if k > len(areas):
                continue
            xx = torch.from_numpy(x[:k]).permute(0, 3, 1, 2).float() / 255.0
            xx = (xx - m.mean) / m.std
            best = 1e9
            for _ in range(a.reps):
                c = time.process_time()
                with torch.inference_mode():
                    m.bb(xx, keep=(8,))
                best = min(best, time.process_time() - c)
            rows.append(dict(photo=f"{cam}/{fname}", areas=len(areas), k=k, fwd=round(best, 4),
                             decode=round(dec, 4), crops_all=round(crop, 4)))
    ks = {}
    for r in rows:
        ks.setdefault(r["k"], []).append(r["fwd"] / r["k"])
    fit_x = np.array([r["k"] for r in rows], float)
    fit_y = np.array([r["fwd"] for r in rows], float)
    slope, icpt = np.polyfit(fit_x, fit_y, 1)
    print(json.dumps(dict(fwd_fit_ms_per_crop=round(slope * 1000, 1), fwd_fit_fixed_ms=round(icpt * 1000, 1),
                          decode_ms=round(1000 * np.mean([r["decode"] for r in rows]), 1),
                          crops_ms_per_area=round(1000 * np.mean([r["crops_all"] / r["areas"] for r in rows]), 2),
                          per_crop_ms_by_k={k: round(1000 * np.mean(v), 1) for k, v in sorted(ks.items())})))
    if a.timing:
        json.dump(rows, open(a.timing, "w"), indent=1)


def main():
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("cmd", choices=["run", "profile"])
    ap.add_argument("--images", required=True)
    ap.add_argument("--planogram", required=True)
    ap.add_argument("--agents", default=str(LAB.parent / "agents"))
    ap.add_argument("--lab-model", default=str(LAB / "models" / "lane_i_ens.pkl"))
    ap.add_argument("--tau", type=float, default=0.9)
    ap.add_argument("--comp", choices=["lab", "r3"], default="lab")
    ap.add_argument("--threads", type=int, default=1)
    ap.add_argument("--out")
    ap.add_argument("--timing")
    ap.add_argument("--tmp", default=None)
    ap.add_argument("--n", type=int, default=6, help="profile: photos")
    ap.add_argument("--reps", type=int, default=3, help="profile: repeats (min is kept)")
    a = ap.parse_args()
    run(a) if a.cmd == "run" else profile(a)


if __name__ == "__main__":
    main()
