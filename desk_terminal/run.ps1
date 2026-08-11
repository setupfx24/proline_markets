# Run the built terminal with the Qt6 DLLs on PATH.
$bin = "E:\msys64\ucrt64\bin"
$env:PATH = "$bin;$env:PATH"
$exe = Join-Path $PSScriptRoot "build\terminal.exe"
if (-not (Test-Path $exe)) { throw "Not built yet. Run build.ps1 first." }
& $exe
