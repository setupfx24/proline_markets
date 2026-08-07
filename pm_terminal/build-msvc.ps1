# Build the Proline Markets Terminal with MSVC + official Qt (WebEngine).
# Usage:  powershell -ExecutionPolicy Bypass -File build-msvc.ps1
#
# The toolchain is DISCOVERED, not hard-coded. The previous version pinned
# "E:\VSBT", "E:\Qt\6.8.3\msvc2022_64" and an MSYS2 ninja, so the script threw
# "Required tool not found" on every machine but the one it was written on —
# including this repo's, where Qt lives on D: and there is no E: drive at all.
# Override any of them with $env:VCVARS / $env:QTDIR / $env:CMAKE / $env:NINJA.
$ErrorActionPreference = "Stop"

$src   = $PSScriptRoot
$build = Join-Path $src "build-msvc"

function Find-Tool([string]$name, [string]$override, [string[]]$candidates) {
    if ($override -and (Test-Path $override)) { return $override }
    foreach ($c in $candidates) {
        $hit = Get-Item $c -ErrorAction SilentlyContinue | Select-Object -First 1
        if ($hit) { return $hit.FullName }
    }
    throw "$name not found. Set the matching env var and re-run."
}

$vcvars = Find-Tool "MSVC (vcvars64.bat)" $env:VCVARS @(
    "E:\VSBT\VC\Auxiliary\Build\vcvars64.bat",
    "C:\Program Files (x86)\Microsoft Visual Studio\2022\*\VC\Auxiliary\Build\vcvars64.bat",
    "C:\Program Files\Microsoft Visual Studio\2022\*\VC\Auxiliary\Build\vcvars64.bat"
)

# Newest Qt kit that actually ships WebEngineWidgets — the chart is a QWebEngine
# view, so a kit without it configures fine and fails at link time.
$qt = $null
if ($env:QTDIR -and (Test-Path "$env:QTDIR\bin\qmake.exe")) { $qt = $env:QTDIR }
if (-not $qt) {
    # Test-Path the roots first, and use PSIsContainer rather than -Directory:
    # -Directory is a FileSystem *dynamic* parameter, so naming a path on a
    # drive that does not exist (E: on this machine) leaves the provider
    # unresolved and Get-ChildItem rejects the switch outright.
    $qtRoots = @("E:\Qt", "D:\Qt", "C:\Qt") | Where-Object { Test-Path $_ }
    $qt = $qtRoots |
          ForEach-Object { Get-ChildItem -LiteralPath $_ -ErrorAction SilentlyContinue } |
          Where-Object { $_.PSIsContainer } |
          ForEach-Object { Get-ChildItem -LiteralPath $_.FullName -ErrorAction SilentlyContinue } |
          Where-Object { $_.PSIsContainer -and $_.Name -like "msvc*_64" } |
          Where-Object { Test-Path "$($_.FullName)\lib\cmake\Qt6WebEngineWidgets" } |
          Sort-Object FullName -Descending |
          Select-Object -First 1 -ExpandProperty FullName
}
if (-not $qt) { throw "No Qt kit with WebEngineWidgets found. Set `$env:QTDIR." }

# Standalone (Kitware) CMake — NOT the MSYS2 one, which injects mingw includes
# that break the MSVC compiler. Same for ninja: any real ninja.exe will do, but
# it must not drag MSYS2's environment in.
$cmake = Find-Tool "cmake.exe" $env:CMAKE @(
    "C:\Program Files\CMake\bin\cmake.exe",
    "$env:APPDATA\Python\Python*\Scripts\cmake.exe",
    "$env:LOCALAPPDATA\Programs\CMake\bin\cmake.exe"
)
$ninja = Find-Tool "ninja.exe" $env:NINJA @(
    "$env:LOCALAPPDATA\Microsoft\WinGet\Packages\Ninja-build.Ninja_*\ninja.exe",
    "E:\msys64\ucrt64\bin\ninja.exe",
    "C:\ProgramData\chocolatey\bin\ninja.exe"
)

Write-Host "    MSVC : $vcvars"
Write-Host "    Qt   : $qt"
Write-Host "    CMake: $cmake"
Write-Host "    Ninja: $ninja"

# A build tree carries the absolute source path it was configured from, so a
# CMakeCache copied in from another checkout makes every configure fail with a
# CMAKE_HOME_DIRECTORY mismatch. Start clean instead of asking the user to.
if (Test-Path "$build\CMakeCache.txt") {
    $home_ = (Select-String -Path "$build\CMakeCache.txt" -Pattern '^CMAKE_HOME_DIRECTORY:INTERNAL=(.*)$' |
              Select-Object -First 1).Matches.Groups[1].Value
    # Keep string literals in this file ASCII-only: it has no BOM, so Windows
    # PowerShell 5.1 decodes it as ANSI, and a UTF-8 em dash lands as a curly
    # quote there - which PowerShell accepts as a string delimiter and which
    # therefore ends the string early. Fine in comments, fatal inside quotes.
    if ($home_ -and ($home_.Replace('\','/').TrimEnd('/') -ne $src.Replace('\','/').TrimEnd('/'))) {
        Write-Host "==> Stale build tree from $home_ - removing." -ForegroundColor Yellow
        Remove-Item -Recurse -Force $build
    }
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
# NOTE: the destination MUST be removed first. `Copy-Item -Recurse src\web dst\web`
# copies the folder *into* dst\web when it already exists (creating dst\web\web)
# and leaves the previous files in place — which silently shipped a stale app.js
# / pm_positions.js for several builds.
$webDst = Join-Path $build "web"
if (Test-Path $webDst) { Remove-Item -Recurse -Force $webDst }
Copy-Item -Recurse -Force "$src\web" $webDst

Write-Host "==> Done. Run:  powershell -File run-msvc.ps1" -ForegroundColor Green
