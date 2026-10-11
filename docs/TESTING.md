# Test it yourself

Two checks anyone on the team can run on their own laptop with what is on main. Nothing is sent anywhere.

Before you start, from the repo root:
- `git pull`, then `python -m pip install -r agents/requirements.txt`;
- the official photos in `data/images/<camera>/<timestamp>.jpg` and `data/planogram.json`, as for the rehearsal (`docs/VALIDATION_DAY.md`);
- Node.js, for the app.

## 1. The model, run exactly as on validation day

Copy the 28 photos of our forward test into a folder outside the repo. The model never trained on them.

    python -I -c "import json,shutil,pathlib as p; o=p.Path.home()/'strivon_test28'; t=json.load(open('eval/benchmark/forward.json'))['test']; [(o/c).mkdir(parents=True,exist_ok=True) or shutil.copy2(f'data/images/{c}/{f}', o/c/f) for c,fs in t.items() for f in fs]; print('photos in', o)"

Run the validation-day script on them:
- PowerShell: `scripts\validation_day.ps1 $HOME\strivon_test28 -ExpectImages 28 -ExpectAreas 304 -Out $HOME\strivon_test28.json`
- bash: `scripts/validation_day.sh $HOME/strivon_test28 --expect-images 28 --expect-areas 304 --out $HOME/strivon_test28.json`

It passes when:
- the predictor prints `stock levels: {'full': 201, 'half': 60, 'empty': 43} | compliant: {True: 297, False: 7}` and then `OK (stock model mix): 304 areas`;
- the check says `28 images, 304 areas, 0 errors`, and the script ends with `OK. Send this file: ...`.

These numbers are the same on Windows and Linux. If you see anything else, stop and tell André.

## 2. The app and the calibration

Write the answers together with the model's confidence, which the app reads, for the same 28 photos:

    python -I agents/predict.py --images $HOME/strivon_test28 --planogram data/planogram.json --out $HOME/t28.json --p-stock-out $HOME/t28_p.json

Start the app on that file. It reads the photos and the planogram from `data/`.
- PowerShell: `cd frontend; npm install; $env:STRIVON_PREDICTIONS = "$HOME\t28_p.json"; npm run dev`
- bash: `cd frontend && npm install && STRIVON_PREDICTIONS=$HOME/t28_p.json npm run dev`

Open the address it prints followed by `#/calibration`, for example http://localhost:5173/#/calibration.

It passes when:
1. With no marker, every crate shows the model's level.
2. Orange at 25% and Full: 5 crates change (3 empty to half, 2 half to full).
3. Banana at 90% and Full: 1 crate changes (full to half).
4. Melon at 1 and Half: 4 crates change.
5. The button that goes back to the model's levels undoes all of it.
6. With orange and melon set, press Export calib.json, then run from the repo root:

       python -I agents/predict.py --images $HOME/strivon_test28 --planogram data/planogram.json --out $HOME/t28_cal.json --calibration $HOME/Downloads/calib.json

   The last line reads `OK (stock model mix, calibration calib.json): 304 areas`, and 9 crates differ from `t28.json`: the same 9 the app changed.

## Rules

- Never commit photos, outputs or calib.json files.
- The scored run is the plain script of part 1: no `--calibration`, `--stock-mode`, `--stock-tilt` or `--label-free`, and never set `ONEPASS_INT8_FROM`.
- Send a file only when the script ends with `OK`.
