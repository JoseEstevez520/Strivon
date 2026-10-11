#!/usr/bin/env bash
# One command for validation day: predict, check, report.
# Usage: scripts/validation_day.sh PATH/TO/validation [--expect-images N] [--expect-areas N] [--out FILE]
# Photos must be laid out as <camera>/<timestamp>.jpg (see docs/VALIDATION_DAY.md).
set -u

EXPECT_IMAGES=26
EXPECT_AREAS=289
IMAGES=""
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
OUT="$ROOT/agents/submission/final.json"
PY="${PYTHON:-python}"

while [ $# -gt 0 ]; do
  case "$1" in
    --expect-images) EXPECT_IMAGES="$2"; shift 2 ;;
    --expect-areas) EXPECT_AREAS="$2"; shift 2 ;;
    --out) OUT="$2"; shift 2 ;;
    -h|--help) sed -n '2,4p' "$0"; exit 0 ;;
    *) IMAGES="$1"; shift ;;
  esac
done

if [ -z "$IMAGES" ] || [ ! -d "$IMAGES" ]; then
  echo "Usage: $0 PATH/TO/validation [--expect-images N] [--expect-areas N] [--out FILE]" >&2
  echo "The folder must exist and hold <camera>/<timestamp>.jpg." >&2
  exit 64
fi
IMAGES="$(cd "$IMAGES" && pwd)"
cd "$ROOT" || exit 64

# Dataset folder: outputs/dataset if it exists, else a temp one built from data/images.
if [ -d "$ROOT/outputs/dataset" ]; then
  DATASET="$ROOT/outputs/dataset"
  PLANOGRAM="$DATASET/planogram.json"
else
  if [ ! -d "$ROOT/data/images" ] || [ ! -f "$ROOT/data/planogram.json" ]; then
    echo "ERROR: no outputs/dataset and no data/images + data/planogram.json to build one." >&2
    exit 64
  fi
  DATASET="$(mktemp -d)"
  trap 'rm -rf "$DATASET"' EXIT
  ln -s "$ROOT/data/images" "$DATASET/Frutas e Legumes (train & test)"
  ln -s "$ROOT/data/planogram.json" "$DATASET/planogram.json"
  PLANOGRAM="$ROOT/data/planogram.json"
fi

export SENSEI_DATASET="$DATASET"
export ONEPASS_THREADS=1
mkdir -p "$(dirname "$OUT")"
rm -f "$OUT"

echo "== Predicting $IMAGES (dataset: $DATASET, 1 thread)"
LOG="$(mktemp)"
"$PY" -I agents/predict.py --images "$IMAGES" --planogram "$PLANOGRAM" --out "$OUT" \
  --expect-images "$EXPECT_IMAGES" --expect-areas "$EXPECT_AREAS" 2>&1 | tee "$LOG"
rc=${PIPESTATUS[0]}
LAST="$(grep -v '^[[:space:]]*$' "$LOG" | tail -n 1)"
rm -f "$LOG"
# Never leave a file behind that could be sent by mistake.
[ $rc -ne 0 ] && rm -f "$OUT"
# A crash (missing package, bad path) also exits 1; only a last line saying INVALID is a format verdict.
if [ $rc -eq 1 ] && [[ "$LAST" != *INVALID* ]]; then
  echo; echo "!! predict.py crashed before giving a verdict (see the error above, e.g. a missing package: python -m pip install -r agents/requirements.txt). Do NOT send anything." >&2
  exit 1
fi

case $rc in
  0) ;;
  1) echo; echo "!! INVALID: the file breaks the format. Do NOT send it. Read the WARN/ERROR lines above and tell André." >&2; exit 1 ;;
  2) echo; echo "!! FALLBACKS: some answers did not come from the model (corrupt photo or failed model). Do NOT send it. Find the photo in the WARN lines above, fix or replace it and run again." >&2; exit 2 ;;
  3) echo; echo "!! INCOMPLETE: photo or area count does not match ($EXPECT_IMAGES photos, $EXPECT_AREAS areas) or files were skipped. Do NOT send it yet. Check the folder layout and the skipped files in the WARN lines; if the real numbers differ, rerun with --expect-images / --expect-areas." >&2; exit 3 ;;
  *) echo; echo "!! predict.py exited with $rc. Do NOT send anything. Read the error above." >&2; exit "$rc" ;;
esac

echo
echo "== Checking $OUT"
"$PY" -I agents/submission/validate.py "$OUT" --images "$IMAGES" --planogram "$PLANOGRAM"
vrc=$?
if [ $vrc -ne 0 ]; then
  echo; echo "!! validate.py failed (exit $vrc). Do NOT send the file. Read the lines above." >&2
  exit 1
fi

echo
echo "OK. Send this file: $OUT"
echo "Stock levels per camera:"
"$PY" -I - "$OUT" <<'PYEOF'
import json, sys
d = json.load(open(sys.argv[1], encoding="utf-8"))
tot = {"empty": 0, "half": 0, "full": 0}
print(f"{'camera':<10}{'photos':>7}{'empty':>7}{'half':>6}{'full':>6}")
for cam in sorted(d):
    c = {"empty": 0, "half": 0, "full": 0}
    for photo in d[cam].values():
        for area in photo.values():
            c[area["stock_level"]] = c.get(area["stock_level"], 0) + 1
    for k in tot:
        tot[k] += c.get(k, 0)
    print(f"{cam:<10}{len(d[cam]):>7}{c['empty']:>7}{c['half']:>6}{c['full']:>6}")
print(f"{'total':<10}{sum(len(v) for v in d.values()):>7}{tot['empty']:>7}{tot['half']:>6}{tot['full']:>6}")
PYEOF
exit 0
