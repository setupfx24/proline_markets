; Inno Setup script — packages the built Proline Markets Terminal into a single
; ProlineMarketsTerminal-Setup.exe installer. Installs per-user (no admin / no UAC).
;
; Paths are relative to this script ({#SourcePath}) rather than absolute: the
; previous version hard-coded "D:\setupfx codes\trading terminal", which broke
; the moment the repo was cloned anywhere else.
#define MyApp "Proline Markets Terminal"
#define MyExe "terminal.exe"
#define BuildDir SourcePath + "build-msvc"

[Setup]
; A FRESH AppId, unlike the Bull4x → SwissCresta renames this build was forked
; from. Those were renames of one product, so they kept the original AppId to
; upgrade in place. Each fork since — SwissCresta, then TuskaEx, now Proline
; Markets — is a DIFFERENT platform, so each gets its own AppId. Inheriting the
; TuskaEx GUID would make this installer overwrite an existing TuskaEx install
; and take over its Apps & features entry. Once published, do not change it
; again — that is what lets a later version upgrade this one.
AppId={{02C9A380-EE8F-4562-9D1D-40219D2A6EAE}
AppName={#MyApp}
; Must match the version in the filename below. The website's download button
; (frontend/trader/src/landing/src/components/Navbar.jsx) links to the STABLE
; name ProlineMarketsTerminal-Setup.exe, so publish this build under that name
; rather than the versioned one — the version lives here and in the EXE's
; VERSIONINFO, not in a URL that has to be edited on every release.
AppVersion=1.0.5
AppPublisher=Proline Markets
DefaultDirName={autopf}\Proline Markets Terminal
DefaultGroupName=Proline Markets Terminal
DisableProgramGroupPage=yes
UninstallDisplayIcon={app}\{#MyExe}
OutputDir={#SourcePath}dist
OutputBaseFilename=ProlineMarketsTerminal-Setup-1.0.5
SetupIconFile={#SourcePath}resources\prolinemarket.ico
Compression=lzma2/max
SolidCompression=yes
WizardStyle=modern

; ── Installing over a RUNNING terminal ───────────────────────────────
; Symptom this fixes:
;     resources\icudtl.dat
;     DeleteFile failed; code 32.
;     The process cannot access the file because it is being used by
;     another process.
;
; Inno already asks Restart Manager to close whatever holds the files it
; is about to replace, but CloseApplicationsFilter defaults to
; *.exe,*.dll,*.chm — and the files QtWebEngine keeps mapped are none of
; those. icudtl.dat, qtwebengine_resources*.pak and v8_context_snapshot.bin
; were never registered, so nothing was detected, the install ran, and it
; died partway through on the first locked one. Widening the filter to
; every file is what actually makes the detection cover them. It costs a
; slower "Preparing to install" scan; a half-installed terminal costs more.
CloseApplications=yes
CloseApplicationsFilter=*.*
; Don't relaunch what we closed — [Run] below already offers to start it,
; and reopening it silently mid-install races the file copy.
RestartApplications=no
; Belt and braces: the app holds this mutex while it runs (see src/main.cpp),
; so Setup can say "close Proline Markets Terminal" up front instead of relying on
; Restart Manager alone. Renaming it breaks that detection on installed
; versions, so leave it alone.
AppMutex=ProlineMarketsTerminal.SingleInstance
PrivilegesRequired=lowest
ArchitecturesAllowed=x64compatible
ArchitecturesInstallIn64BitMode=x64compatible

[Languages]
Name: "english"; MessagesFile: "compiler:Default.isl"

[Tasks]
Name: "desktopicon"; Description: "Create a desktop shortcut"; GroupDescription: "Additional shortcuts:"

[Files]
; ignoreversion is NOT optional here.
;
; Inno's default for a file carrying version info is to replace it only when
; the incoming version is HIGHER. terminal.exe declares its version from
; resources/app.rc, and that had been left at 1.0.1 across builds — so an
; upgrade compared 1.0.1 against 1.0.1, decided there was nothing to do, and
; skipped the executable. Setup still wrote the uninstaller and stamped
; DisplayVersion=1.0.2 into Apps & features, which is the worst possible
; outcome: the machine reports 1.0.2 while running the older binary, and the
; only symptom is "my changes aren't there".
;
; app.rc is bumped alongside AppVersion now, but this flag is the belt to that
; brace — a build where someone forgets to bump still ships, because the file
; is replaced on every install regardless of what its version claims.
Source: "{#BuildDir}\*"; DestDir: "{app}"; Flags: recursesubdirs createallsubdirs ignoreversion; \
  Excludes: "CMakeFiles\*,terminal_autogen\*,*.obj,*.pdb,*.ilk,*.cmake,CMakeCache.txt,build.ninja,.ninja_deps,.ninja_log,*.ninja_deps,*.ninja_log,chart-diag.log"

[Icons]
Name: "{group}\Proline Markets Terminal"; Filename: "{app}\{#MyExe}"
Name: "{autodesktop}\Proline Markets Terminal"; Filename: "{app}\{#MyExe}"; Tasks: desktopicon

[Run]
Filename: "{app}\{#MyExe}"; Description: "Launch Proline Markets Terminal"; Flags: nowait postinstall skipifsilent
