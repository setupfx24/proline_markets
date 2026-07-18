<#
    build.ps1 — configure + build Proline Terminal (Qt + MSVC).

    Uses the Visual Studio generator (MSBuild) which discovers the MSVC toolset
    from the Build Tools install directly — no vcvars juggling, and it avoids a
    Ninja rule-generation bug on this CMake build.

    Usage (from desktop-terminal\):
        powershell -ExecutionPolicy Bypass -File scripts\build.ps1
        scripts\build.ps1 -Config Debug -Run
#>

param(
    [string]$QtPrefix = 'D:\Qt\6.7.3\msvc2019_64',
    [ValidateSet('Debug','Release')][string]$Config = 'Release',
    [switch]$Run
)

$ErrorActionPreference = 'Stop'
$root  = Split-Path -Parent $PSScriptRoot
$build = Join-Path $root 'build'

if (-not (Test-Path "$QtPrefix\bin\qmake.exe")) {
    throw "Qt not found at $QtPrefix. Run scripts\setup-toolchain.ps1 or pass -QtPrefix."
}

# Locate cmake.exe (winget install may not be on this shell's PATH yet).
$cmake = (Get-Command cmake -ErrorAction SilentlyContinue).Source
if (-not $cmake) {
    $cmake = @(
        "$env:ProgramFiles\CMake\bin\cmake.exe",
        "${env:ProgramFiles(x86)}\CMake\bin\cmake.exe"
    ) | Where-Object { Test-Path $_ } | Select-Object -First 1
}
if (-not $cmake) { throw "cmake.exe not found. Install: winget install Kitware.CMake" }

# CMake wants forward slashes in path values.
$qtFwd = $QtPrefix -replace '\\','/'

Write-Host "Configuring (Visual Studio 17 2022, x64)..." -ForegroundColor Cyan
& $cmake -S $root -B $build -G "Visual Studio 17 2022" -A x64 "-DCMAKE_PREFIX_PATH=$qtFwd"
if ($LASTEXITCODE -ne 0) { throw "CMake configure failed." }

Write-Host "Building ($Config)..." -ForegroundColor Cyan
& $cmake --build $build --config $Config --parallel
if ($LASTEXITCODE -ne 0) { throw "Build failed." }

$exe = Join-Path $build "$Config\ProlineTerminal.exe"
Write-Host "`nBuilt: $exe" -ForegroundColor Green
if ($Run) { & $exe }
