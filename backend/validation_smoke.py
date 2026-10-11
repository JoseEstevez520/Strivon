"""Smoke test for the validation runner. Run from anywhere:

    python backend/validation_smoke.py [--per-camera 2] [--flat] [--all]

Needs the server's dependencies (fastapi, httpx for the TestClient) and the torch install that
agents/predict.py needs. Uploads photos from data/images, runs the predictor, polls, prints the verdict.
"""
from __future__ import annotations

import argparse
import json
import sys
import time
from pathlib import Path

HERE = Path(__file__).resolve().parent
REPO = HERE.parent
sys.path.insert(0, str(HERE))

IMAGES = REPO / "data" / "images"
PLANOGRAM = REPO / "data" / "planogram.json"


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--per-camera", type=int, default=2)
    ap.add_argument("--all", action="store_true", help="upload every photo in data/images")
    ap.add_argument("--flat", action="store_true", help="send bare file names, no camera folders")
    ap.add_argument("--timeout", type=int, default=900)
    a = ap.parse_args()

    from fastapi.testclient import TestClient
    from app.server import app

    cams = json.loads(PLANOGRAM.read_text(encoding="utf-8"))["Frutas e Legumes"]["cameras"]
    picked = []
    for cam_dir in sorted(p for p in IMAGES.iterdir() if p.is_dir() and p.name in cams):
        photos = sorted(cam_dir.glob("*.jpg"))
        picked += [(cam_dir.name, p) for p in (photos if a.all else photos[: a.per_camera])]
    n_areas = sum(len(cams[c]["products"]) for c, _ in picked)
    print(f"uploading {len(picked)} photos, expecting {n_areas} areas")

    c = TestClient(app)
    files = [("files", ((p.name if a.flat else f"{cam}/{p.name}"), p.read_bytes(), "image/jpeg")) for cam, p in picked]
    r = c.post("/api/validation/upload", files=files)
    print("upload:", r.status_code, r.json())
    assert r.status_code == 200, r.text

    r = c.post("/api/validation/run", json={"expect_images": len(picked), "expect_areas": n_areas})
    print("run:", r.status_code, r.json())
    assert r.status_code == 200, r.text
    assert c.post("/api/validation/run", json={}).status_code == 409, "second run should be refused"
    assert c.get("/api/validation/result").status_code == 404, "no result while running"

    t0 = time.time()
    while time.time() - t0 < a.timeout:
        s = c.get("/api/validation/status").json()
        if s["state"] in ("done", "error"):
            break
        time.sleep(3)
    print("\n".join(s["log"][-12:]))
    print("state:", s["state"], "| verdict:", s["verdict"], "| exit:", s["exit_code"], "| seconds:", s["seconds"])
    print("last_line:", s["last_line"])
    print("validator:", s["validator"])

    res = c.get("/api/validation/result")
    print("result:", res.status_code, len(res.content), "bytes")
    sm = c.get("/api/validation/summary")
    if sm.status_code == 200:
        j = sm.json()
        for cam, v in j["cameras"].items():
            print(f"  {cam}: {v}")
        print("totals:", j["totals"])
    ok = bool(s["validator"] and s["validator"]["ok"]) and res.status_code == 200
    print("SMOKE", "PASS" if ok else "FAIL")
    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(main())
