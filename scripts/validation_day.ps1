# One command for validation day: predict, check, report.
# Usage: scripts\validation_day.ps1 PATH\TO\validation [-ExpectImages N] [-ExpectAreas N] [-Out FILE]
# Photos must be laid out as <camera>\<timestamp>.jpg (see docs/VALIDATION_DAY.md).
param(
    [Parameter(Mandatory = $true, Position = 0)][string]$Images,
    [int]$ExpectImages = 26,
    [int]$ExpectAreas = 289,
    [string]$Out = "",
    [string]$Python = $(if ($env:PYTHON) { $env:PYTHON } else { "python" })
)
$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot
if (-not $Out) { $Out = Join-Path $Root "agents\submission\final.json" }
if (-not (Test-Path -LiteralPath $Images -PathType Container)) {
    Write-Host "The folder '$Images' does not exist. It must hold <camera>\<timestamp>.jpg." -ForegroundColor Red
    exit 64
}
$Images = (Resolve-Path -LiteralPath $Images).Path
Set-Location $Root

# Dataset folder: outputs\dataset if it exists, else a temp one built from data\images.
$tmp = $null
if (Test-Path (Join-Path $Root "outputs\dataset")) {
    $Dataset = Join-Path $Root "outputs\dataset"
    $Planogram = Join-Path $Dataset "planogram.json"
} else {
    $src = Join-Path $Root "data\images"
    $plan = Join-Path $Root "data\planogram.json"
    if (-not (Test-Path $src) -or -not (Test-Path $plan)) {
        Write-Host "No outputs\dataset and no data\images + data\planogram.json to build one." -ForegroundColor Red
        exit 64
    }
    $tmp = Join-Path ([IO.Path]::GetTempPath()) ("sensei_ds_" + [guid]::NewGuid().ToString("N"))
    New-Item -ItemType Directory -Path $tmp | Out-Null
    # Junctions need no admin rights on Windows; the planogram is just copied.
    New-Item -ItemType Junction -Path (Join-Path $tmp "Frutas e Legumes (train & test)") -Target (Resolve-Path $src).Path | Out-Null
    Copy-Item $plan (Join-Path $tmp "planogram.json")
    $Dataset = $tmp
    $Planogram = $plan
}

# Delete the junction itself first: Remove-Item -Recurse on a junction can wipe the target in Windows PowerShell 5.1.
function Remove-TempDataset {
    if (-not $tmp) { return }
    $link = Join-Path $tmp "Frutas e Legumes (train & test)"
    if (Test-Path -LiteralPath $link) { [IO.Directory]::Delete($link) }
    Remove-Item -LiteralPath $tmp -Recurse -Force -ErrorAction SilentlyContinue
}

function Stop-Run($code, $msg) {
    Write-Host ""
    Write-Host "!! $msg" -ForegroundColor Red
    if (Test-Path -LiteralPath $Out) { Remove-Item -LiteralPath $Out -Force }
    Remove-TempDataset
    exit $code
}

$env:SENSEI_DATASET = $Dataset
$env:ONEPASS_THREADS = "1"
New-Item -ItemType Directory -Force -Path (Split-Path -Parent $Out) | Out-Null
if (Test-Path -LiteralPath $Out) { Remove-Item -LiteralPath $Out -Force }

Write-Host "== Predicting $Images (dataset: $Dataset, 1 thread)"
$ErrorActionPreference = "Continue"
$lines = & $Python -I agents/predict.py --images $Images --planogram $Planogram --out $Out `
    --expect-images $ExpectImages --expect-areas $ExpectAreas 2>&1 | ForEach-Object { "$_" } | Tee-Object -Variable log
$rc = $LASTEXITCODE
$ErrorActionPreference = "Stop"
$last = ($log | Where-Object { $_.Trim() } | Select-Object -Last 1)

switch ($rc) {
    0 { }
    1 {
        if ($last -notmatch "INVALID") {
            Stop-Run 1 "predict.py crashed before giving a verdict (see the error above, e.g. a missing package: python -m pip install -r agents/requirements.txt). Do NOT send anything."
        }
        Stop-Run 1 "INVALID: the file breaks the format. Do NOT send it. Read the WARN/ERROR lines above and tell André."
    }
    2 { Stop-Run 2 "FALLBACKS: some answers did not come from the model (corrupt photo or failed model). Do NOT send it. Find the photo in the WARN lines above, fix or replace it and run again." }
    3 { Stop-Run 3 "INCOMPLETE: photo or area count does not match ($ExpectImages photos, $ExpectAreas areas) or files were skipped. Do NOT send it yet. Check the folder layout and the skipped files in the WARN lines; if the real numbers differ, rerun with -ExpectImages / -ExpectAreas." }
    default { Stop-Run $rc "predict.py exited with $rc. Do NOT send anything. Read the error above." }
}

Write-Host ""
Write-Host "== Checking $Out"
& $Python -I agents/submission/validate.py $Out --images $Images --planogram $Planogram
if ($LASTEXITCODE -ne 0) { Stop-Run 1 "validate.py failed (exit $LASTEXITCODE). Do NOT send the file. Read the lines above." }

Write-Host ""
Write-Host "OK. Send this file: $Out" -ForegroundColor Green
Write-Host "Stock levels per camera:"
$d = Get-Content -Raw -Encoding UTF8 -LiteralPath $Out | ConvertFrom-Json
$tot = @{ empty = 0; half = 0; full = 0 }; $np = 0
$rows = foreach ($cam in ($d.PSObject.Properties | Sort-Object Name)) {
    $c = @{ empty = 0; half = 0; full = 0 }; $n = 0
    foreach ($photo in $cam.Value.PSObject.Properties) {
        $n++
        foreach ($area in $photo.Value.PSObject.Properties) { $c[$area.Value.stock_level]++ }
    }
    foreach ($k in $tot.Keys.Clone()) { $tot[$k] += $c[$k] }
    $np += $n
    [pscustomobject]@{ camera = $cam.Name; photos = $n; empty = $c.empty; half = $c.half; full = $c.full }
}
$rows += [pscustomobject]@{ camera = "total"; photos = $np; empty = $tot.empty; half = $tot.half; full = $tot.full }
$rows | Format-Table -AutoSize | Out-String | Write-Host
Remove-TempDataset
exit 0
