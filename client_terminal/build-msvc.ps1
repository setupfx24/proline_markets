# Build the Proline Terminal with MSVC + official Qt 6.8.3 (WebEngine).
# Usage:  powershell -ExecutionPolicy Bypass -File build-msvc.ps1
$ErrorActionPreference = "Stop"

$vcvars = "E:\VSBT\VC\Auxiliary\Build\vcvars64.bat"
$qt     = "E:\Qt\6.8.3\msvc2022_64"
# Standalone (Kitware) CMake — NOT the MSYS2 one, which injects mingw includes
# that break the MSVC compiler.
$cmake  = "$env:APPDATA\Python\Python314\Scripts\cmake.exe"
$ninja  = "E:\msys64\ucrt64\bin\ninja.exe"
$src    = $PSScriptRoot
$build  = Join-Path $src "build-msvc"

foreach ($p in @($vcvars, "$qt\bin\qmake.exe", $cmake, $ninja)) {
    if (-not (Test-Path $p)) { throw "Required tool not found: $p" }
}

Write-Host "==> Importing MSVC environment (vcvars64)..." -ForegroundColor Cyan
cmd /c "`"$vcvars`" >nul 2>&1 && set" | ForEach-Object {
    if ($_ -match "^(.*?)=(.*)$") { Set-Item -Path "env:$($matches[1])" -Value $matches[2] }
}

Write-Host "==> Configuring (Ninja / MSVC / Qt WebEngine)..." -ForegroundColor Cyan
& $cmake -S "$src" -B "$build" -G Ninja `
    -DCMAKE_MAKE_PROGRAM="$ninja" `
    -DCMAKE_BUILD_TYPE=Release `
    -DCMAKE_C_COMPILER=cl -DCMAKE_CXX_COMPILER=cl `
    -DCMAKE_PREFIX_PATH="$qt"
if ($LASTEXITCODE -ne 0) { throw "CMake configure failed" }

Write-Host "==> Building..." -ForegroundColor Cyan
& $cmake --build "$build"
if ($LASTEXITCODE -ne 0) { throw "Build failed" }

Write-Host "==> Deploying Qt runtime (windeployqt)..." -ForegroundColor Cyan
& "$qt\bin\windeployqt.exe" --release --no-translations "$build\terminal.exe" | Out-Null

# Copy the web assets next to the exe for a self-contained run.
Copy-Item -Recurse -Force "$src\web" "$build\web"

Write-Host "==> Done. Run:  powershell -File run-msvc.ps1" -ForegroundColor Green
