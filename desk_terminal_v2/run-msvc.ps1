# Run the MSVC/WebEngine build. windeployqt already copied the Qt runtime
# (DLLs, QtWebEngineProcess, resources) next to the exe, so it is standalone.
$exe = Join-Path $PSScriptRoot "build-msvc\terminal.exe"
if (-not (Test-Path $exe)) { throw "Not built yet. Run build-msvc.ps1 first." }
& $exe
