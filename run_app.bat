@echo off
cd /d "%~dp0backend"
if not exist "..\outputs\details.json" python -m sensei predict
start "" http://127.0.0.1:8000
python -m sensei serve --host 0.0.0.0 --port 8000
