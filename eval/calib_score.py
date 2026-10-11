"""Score a calibration file (the app's calib.json) in seconds, without re-running the model.

    python -I eval/calib_score.py calib.json --planogram PATH/planogram.json

Uses the 5-fold OUT-OF-FOLD stock probabilities of the submitted mix model (eval/benchmark/preds/agents_mix_oof_s0.json,
1962 areas of the 181 training photos, each predicted by a model that never saw its photo), the same calibration rule as
agents/predict.py --calibration (load_calibration / calibrated_level), and the labels in eval/labels.json.
Prints the rules' points (identification + stock) without and with the calibration, and the change per product.
Out-of-fold matters: in-sample probabilities would just echo the training labels and reward over-fitted thresholds.
Few points per product still over-fit: trust changes of several areas, not +1 or +3.
"""
import argparse
import json
import sys
from collections import defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "agents"))
import predict  # noqa: E402  (load_calibration, calibrated_level: the predictor's own rule)

PAY = [[1, -2, -2], [-3, 1, -2], [-3, -3, 1]]
LV = (0.0, 0.5, 1.0)


def best(p):
    ev = [sum(PAY[r][j] * p[j] for j in range(3)) for r in range(3)]
    return LV[max(range(3), key=lambda r: ev[r])]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("calib")
    ap.add_argument("--planogram", required=True)
    ap.add_argument("--preds", default=str(ROOT / "eval" / "benchmark" / "preds" / "agents_mix_oof_s0.json"))
    ap.add_argument("--labels", default=str(ROOT / "eval" / "labels.json"))
    a = ap.parse_args()
    rules = predict.load_calibration(a.calib)
    pg = json.loads(Path(a.planogram).read_text(encoding="utf-8"))
    cams = pg.get("Frutas e Legumes", pg).get("cameras", pg)
    pid = {x["area_id"]: str(x["product_id"]) for c in cams.values() for x in c["products"]}
    P = json.loads(Path(a.preds).read_text(encoding="utf-8"))
    K = json.loads(Path(a.labels).read_text(encoding="utf-8"))
    tot = {"default": [0, 0], "calibrated": [0, 0]}
    per = defaultdict(lambda: [0, 0])
    for c, imgs in K.items():
        for img, areas in imgs.items():
            if predict.CURTAIN_PHOTOS.get(c) == img if hasattr(predict, "CURTAIN_PHOTOS") else False:
                continue
            for aid, t in areas.items():
                e = P.get(c, {}).get(img, {}).get(aid)
                if e is None or e.get("p_stock") is None:
                    continue
                p = e["p_stock"]
                d = best(p)
                rule = rules.get(pid.get(aid))
                if rule is not None:
                    fill = 100 * (0.5 * p[1] + p[2])
                    units = None if rule["unit"] != "count" else int((fill / 100 * rule["capacity"]) + 0.5)
                    k = float(predict.calibrated_level(fill, units, rule))
                else:
                    k = d
                tv = float(t["stock_value"])
                ident = 1 if bool(e["planogram_compliant"]) == bool(t["planogram_compliant"]) else -2
                for name, v in (("default", d), ("calibrated", k)):
                    s = 1 if v == tv else (-2 if v < tv else -3)
                    tot[name][0] += ident; tot[name][1] += s
                if rule is not None:
                    per[pid[aid]][0] += (1 if d == tv else (-2 if d < tv else -3))
                    per[pid[aid]][1] += (1 if k == tv else (-2 if k < tv else -3))
    for name, (i, s) in tot.items():
        print(f"{name:10s}: total {i + s:+d} (identification {i:+d}, stock {s:+d})")
    print(f"change: {sum(tot['calibrated']) - sum(tot['default']):+d}")
    for p_, (d, k) in sorted(per.items(), key=lambda x: x[1][1] - x[1][0]):
        if d != k:
            print(f"  product {p_}: stock {d:+d} -> {k:+d} ({k - d:+d})")


if __name__ == "__main__":
    main()
