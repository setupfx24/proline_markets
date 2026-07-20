# Build the Proline Terminal with the MSYS2 UCRT64 toolchain.
# Usage:  powershell -ExecutionPolicy Bypass -File build.ps1
$ErrorActionPreference = "Stop"

$ucrt  = "E:\msys64\ucrt64"
$bin   = "$ucrt\bin"
$src   = $PSScriptRoot
$build = Join-Path $src "build"

if (-not (Test-Path $bin)) { throw "MSYS2 UCRT64 not found at $bin" }

# Put the toolchain (gcc, cmake, ninja, Qt DLLs) first on PATH.
$env:PATH = "$bin;$env:PATH"

Write-Host "==> Configuring (Ninja / g++ / Qt6)..." -ForegroundColor Cyan
# -O1 keeps peak compiler memory low (Qt/Charts headers are heavy and the
# system pagefile is tight). Build single-threaded for the same reason.
cmake -S "$src" -B "$build" -G Ninja `
    -DCMAKE_BUILD_TYPE=Release `
    -DCMAKE_C_COMPILER=gcc.exe `
    -DCMAKE_CXX_COMPILER=g++.exe `
    -DCMAKE_PREFIX_PATH="$ucrt" `
    -DCMAKE_CXX_FLAGS_RELEASE="-O1 -DNDEBUG" `
    -DCMAKE_C_FLAGS_RELEASE="-O1 -DNDEBUG"
if ($LASTEXITCODE -ne 0) { throw "CMake configure failed" }

Write-Host "==> Building (single-threaded to limit memory)..." -ForegroundColor Cyan
cmake --build "$build" -j 1
if ($LASTEXITCODE -ne 0) { throw "Build failed" }

Write-Host "==> Done. Run with:  powershell -File run.ps1" -ForegroundColor Green
