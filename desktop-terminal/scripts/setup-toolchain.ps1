<#
    setup-toolchain.ps1 — one-time dev toolchain install for Proline Terminal.

    Installs everything needed to build the Qt/C++ desktop terminal on Windows:
      * CMake + Ninja               (winget)
      * Python 3                    (winget, if missing — used by aqtinstall)
      * MSVC Build Tools 2022 (C++) (winget, ~3-6 GB)
      * Qt 6.7.x (msvc2019_64)      (aqtinstall -> C:\Qt)

    Run from an ELEVATED PowerShell:
        powershell -ExecutionPolicy Bypass -File scripts\setup-toolchain.ps1

    Heavy download (several GB). Safe to re-run — each step is skipped if present.
#>

$ErrorActionPreference = 'Stop'
$QtVersion = '6.7.3'
$QtArch    = 'win64_msvc2019_64'
$QtDir     = 'C:\Qt'

function Have($n) { [bool](Get-Command $n -ErrorAction SilentlyContinue) }
function Step($m) { Write-Host "`n=== $m ===" -ForegroundColor Cyan }

if (-not (Have winget)) {
    throw "winget not found. Install 'App Installer' from the Microsoft Store, then re-run."
}

Step "CMake"
if (Have cmake) { Write-Host "cmake present." } else {
    winget install --id Kitware.CMake --accept-source-agreements --accept-package-agreements -e
}

Step "Ninja"
if (Have ninja) { Write-Host "ninja present." } else {
    winget install --id Ninja-build.Ninja --accept-source-agreements --accept-package-agreements -e
}

Step "Python (for aqtinstall)"
if (Have python) { Write-Host "python present." } else {
    winget install --id Python.Python.3.12 --accept-source-agreements --accept-package-agreements -e
}

Step "MSVC Build Tools 2022 (C++ workload)"
$vswhere = "${env:ProgramFiles(x86)}\Microsoft Visual Studio\Installer\vswhere.exe"
$haveMsvc = $false
if (Test-Path $vswhere) {
    $inst = & $vswhere -latest -products * -requires Microsoft.VisualStudio.Component.VC.Tools.x86.x64 -property installationPath 2>$null
    if ($inst) { $haveMsvc = $true; Write-Host "MSVC C++ toolset present at $inst" }
}
if (-not $haveMsvc) {
    Write-Host "Installing VS 2022 Build Tools with the C++ workload (this is the big one)..."
    winget install --id Microsoft.VisualStudio.2022.BuildTools --accept-source-agreements --accept-package-agreements -e `
        --override "--quiet --wait --norestart --add Microsoft.VisualStudio.Workload.VCTools --includeRecommended"
}

Step "Qt $QtVersion ($QtArch) via aqtinstall"
if (Test-Path "$QtDir\$QtVersion\msvc2019_64\bin\qmake.exe") {
    Write-Host "Qt $QtVersion already installed at $QtDir."
} else {
    python -m pip install --upgrade pip aqtinstall
    python -m aqt install-qt windows desktop $QtVersion $QtArch -O $QtDir -m qtcharts qtwebsockets
}

Step "Done"
Write-Host "Qt prefix:  $QtDir\$QtVersion\msvc2019_64" -ForegroundColor Green
Write-Host "Next: open a NEW terminal (so PATH refreshes) and run scripts\build.ps1" -ForegroundColor Green
