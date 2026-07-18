<#
    package.ps1 — build a Release binary and wrap it in a Windows installer.

    Steps:
      1. Build ProlineTerminal (Release) via build.ps1
      2. Stage the exe and let windeployqt gather Qt DLLs + plugins + VC runtime
      3. Compile scripts\installer.iss with Inno Setup (ISCC) -> dist\ProlineTerminal-Setup.exe

    Requires: MSVC + Qt (setup-toolchain / install-msvc), and Inno Setup 6.

    Usage (from desktop-terminal\):
        powershell -ExecutionPolicy Bypass -File scripts\package.ps1
#>

param(
    [string]$QtPrefix = 'D:\Qt\6.7.3\msvc2019_64',
    [string]$Version  = '0.1.0'
)

$ErrorActionPreference = 'Stop'
$root  = Split-Path -Parent $PSScriptRoot
$build = Join-Path $root 'build'
$dist  = Join-Path $root 'dist'
$stage = Join-Path $dist 'stage'

# 1. Build Release --------------------------------------------------------
Write-Host "=== Building Release ===" -ForegroundColor Cyan
& (Join-Path $PSScriptRoot 'build.ps1') -QtPrefix $QtPrefix -Config Release

# VS generator puts the binary in a per-config subfolder.
$exe = Join-Path $build 'Release\ProlineTerminal.exe'
if (-not (Test-Path $exe)) { throw "Build did not produce $exe" }

# 2. Stage + windeployqt --------------------------------------------------
Write-Host "=== Staging + windeployqt ===" -ForegroundColor Cyan
if (Test-Path $stage) { Remove-Item $stage -Recurse -Force }
New-Item -ItemType Directory -Force $stage | Out-Null
Copy-Item $exe $stage

$windeploy = Join-Path $QtPrefix 'bin\windeployqt.exe'
if (-not (Test-Path $windeploy)) { throw "windeployqt not found at $windeploy" }
& $windeploy --release --no-translations `
    --dir $stage (Join-Path $stage 'ProlineTerminal.exe')
if ($LASTEXITCODE -ne 0) { throw "windeployqt failed." }

# Bundle the MSVC runtime DLLs (Qt msvc build uses the dynamic CRT, so the target
# machine needs these). windeployqt's --compiler-runtime needs VCINSTALLDIR; the
# redistributable copies in System32 are equivalent and always present here.
foreach ($dll in 'vcruntime140.dll','vcruntime140_1.dll','msvcp140.dll') {
    $src = Join-Path $env:SystemRoot "System32\$dll"
    if (Test-Path $src) { Copy-Item $src $stage -Force }
    else { Write-Warning "CRT DLL not found: $src" }
}

# 3. Inno Setup -----------------------------------------------------------
Write-Host "=== Building installer (Inno Setup) ===" -ForegroundColor Cyan
$iscc = @(
    "$env:LOCALAPPDATA\Programs\Inno Setup 6\ISCC.exe",
    "${env:ProgramFiles(x86)}\Inno Setup 6\ISCC.exe",
    "${env:ProgramFiles}\Inno Setup 6\ISCC.exe"
) | Where-Object { Test-Path $_ } | Select-Object -First 1
if (-not $iscc) { throw "ISCC.exe (Inno Setup 6) not found. Install: winget install JRSoftware.InnoSetup" }

& $iscc "/DMyAppVersion=$Version" "/DStageDir=$stage" "/DOutputDir=$dist" `
    (Join-Path $PSScriptRoot 'installer.iss')
if ($LASTEXITCODE -ne 0) { throw "Inno Setup failed." }

Write-Host "`nInstaller ready: $dist\ProlineTerminal-Setup.exe" -ForegroundColor Green
