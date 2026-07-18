<#
    install-msvc.ps1 — install the MSVC C++ compiler (VS 2022 Build Tools).

    This is the ONE step that needs administrator rights. It uses the
    Build Tools bootstrapper directly (no winget), so it works even in an
    elevated shell where winget isn't available.

    HOW TO RUN (either way):
      * Right-click this file  ->  "Run with PowerShell"  (accept the UAC prompt), OR
      * From an elevated PowerShell:
            powershell -ExecutionPolicy Bypass -File scripts\install-msvc.ps1

    Installs the "Desktop development with C++" toolset (MSVC + Windows SDK).
    ~4-7 GB download. Safe to re-run.
#>

$ErrorActionPreference = 'Stop'

# Self-elevate if not already admin.
$id = [System.Security.Principal.WindowsIdentity]::GetCurrent()
$isAdmin = (New-Object System.Security.Principal.WindowsPrincipal($id)).IsInRole(
    [System.Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $isAdmin) {
    Write-Host "Requesting administrator rights..." -ForegroundColor Yellow
    Start-Process powershell -Verb RunAs -ArgumentList @(
        '-ExecutionPolicy','Bypass','-File',"`"$PSCommandPath`"")
    return
}

$boot = Join-Path $PSScriptRoot 'vs_BuildTools.exe'
if (-not (Test-Path $boot)) {
    Write-Host "Downloading VS Build Tools bootstrapper..." -ForegroundColor Cyan
    Invoke-WebRequest -Uri 'https://aka.ms/vs/17/release/vs_BuildTools.exe' -OutFile $boot
}

# C: is tight on this machine, so install the toolset to D: and don't keep the
# download cache. vswhere/CMake still discover it by registration, path aside.
$installPath = 'D:\VS\BuildTools'
Write-Host "Installing 'Desktop development with C++' to $installPath (this takes a while)..." -ForegroundColor Cyan
$p = Start-Process -FilePath $boot -Wait -PassThru -ArgumentList @(
    '--quiet','--wait','--norestart','--nocache',
    '--installPath',"`"$installPath`"",
    '--add','Microsoft.VisualStudio.Workload.VCTools',
    '--includeRecommended'
)
Write-Host "Installer exit code: $($p.ExitCode)"
if ($p.ExitCode -eq 0 -or $p.ExitCode -eq 3010) {
    Write-Host "MSVC C++ toolset installed. Open a NEW terminal, then build." -ForegroundColor Green
} else {
    Write-Host "Install returned $($p.ExitCode). Re-run, or use the Visual Studio Installer GUI to add 'Desktop development with C++'." -ForegroundColor Red
}