; Inno Setup script — packages the built Proline Terminal into a single
; ProlineTerminal-Setup.exe installer. Installs per-user (no admin / no UAC).
#define MyApp "Proline Terminal"
#define MyExe "terminal.exe"
; Resolved from this script's own folder so the installer builds on any
; machine. The previous script hardcoded one developer's D:\ path.
#define BuildDir SourcePath + "build-msvc"
#define DistDir  SourcePath + "dist"

[Setup]
; Regenerated: the old AppId was not a valid GUID (its last group spelled out
; the brand name), and reusing it would tie this installer to the old product.
AppId={{EC178288-349C-42C7-959F-C61CD707D5D8}
AppName={#MyApp}
AppVersion=1.0.0
AppPublisher=Proline Markets
AppPublisherURL=https://prolinemarket.com
DefaultDirName={autopf}\Proline Terminal
DefaultGroupName=Proline Terminal
DisableProgramGroupPage=yes
UninstallDisplayIcon={app}\{#MyExe}
OutputDir={#DistDir}
OutputBaseFilename=ProlineTerminal-Setup
Compression=lzma2/max
SolidCompression=yes
WizardStyle=modern
PrivilegesRequired=lowest
ArchitecturesAllowed=x64compatible
ArchitecturesInstallIn64BitMode=x64compatible

[Languages]
Name: "english"; MessagesFile: "compiler:Default.isl"

[Tasks]
Name: "desktopicon"; Description: "Create a desktop shortcut"; GroupDescription: "Additional shortcuts:"

[Files]
Source: "{#BuildDir}\*"; DestDir: "{app}"; Flags: recursesubdirs createallsubdirs; \
  Excludes: "CMakeFiles\*,terminal_autogen\*,*.obj,*.pdb,*.ilk,*.cmake,CMakeCache.txt,build.ninja,.ninja_deps,.ninja_log,*.ninja_deps,*.ninja_log,chart-diag.log"

[Icons]
Name: "{group}\Proline Terminal"; Filename: "{app}\{#MyExe}"
Name: "{autodesktop}\Proline Terminal"; Filename: "{app}\{#MyExe}"; Tasks: desktopicon

[Run]
Filename: "{app}\{#MyExe}"; Description: "Launch Proline Terminal"; Flags: nowait postinstall skipifsilent
