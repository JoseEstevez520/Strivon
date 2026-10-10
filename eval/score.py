"""Score predictions against annotations using the Sensei challenge rules.

Usage: python eval/score.py predictions.json annotations.json

Both files: {camera: {image: {area_id: {planogram_compliant, stock_value}}}}
Per area: identification +1 / -2; stock correct +1, below real -2, above real -3.
A missing area counts as wrong identification and stock above real (-5 total).
"""
import json
import sys


def score_area(pred, truth):
    if pred is None:
        return -2, -3
    ident = 1 if bool(pred["planogram_compliant"]) == bool(truth["planogram_compliant"]) else -2
    p, t = float(pred["stock_value"]), float(truth["stock_value"])
    stock = 1 if p == t else (-2 if p < t else -3)
    return ident, stock


def score(preds, truth):
    tot = {"ident": 0, "stock": 0, "areas": 0, "ident_ok": 0, "stock_ok": 0, "below": 0, "above": 0}
    for cam, imgs in truth.items():
        for img, areas in imgs.items():
            for area_id, t in areas.items():
                p = preds.get(cam, {}).get(img, {}).get(area_id)
                i, s = score_area(p, t)
                tot["areas"] += 1
                tot["ident"] += i
                tot["stock"] += s
                tot["ident_ok"] += i == 1
                tot["stock_ok"] += s == 1
                tot["below"] += s == -2
                tot["above"] += s == -3
    tot["total"] = tot["ident"] + tot["stock"]
    tot["max"] = 2 * tot["areas"]
    return tot


if __name__ == "__main__":
    with open(sys.argv[1]) as f:
        preds = json.load(f)
    with open(sys.argv[2]) as f:
        truth = json.load(f)
    r = score(preds, truth)
    print(json.dumps(r, indent=2))
