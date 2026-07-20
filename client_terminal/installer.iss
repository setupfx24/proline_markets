; Inno Setup script — packages the built Bull4x Terminal into a single
; Bull4xTerminal-Setup.exe installer. Installs per-user (no admin / no UAC).
#define MyApp "Bull4x Terminal"
#define MyExe "terminal.exe"
#define BuildDir "D:\setupfx codes\trading terminal\build-msvc"

[Setup]
AppId={{7C1B4E2A-9F3D-4C6E-B8A1-BULL4XTERMINAL}
AppName={#MyApp}
AppVersion=1.0.0
AppPublisher=Bull4x
DefaultDirName={autopf}\Bull4x Terminal
DefaultGroupName=Bull4x Terminal
DisableProgramGroupPage=yes
UninstallDisplayIcon={app}\{#MyExe}
OutputDir=D:\setupfx codes\trading terminal\dist
OutputBaseFilename=Bull4xTerminal-Setup
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
Name: "{group}\Bull4x Terminal"; Filename: "{app}\{#MyExe}"
Name: "{autodesktop}\Bull4x Terminal"; Filename: "{app}\{#MyExe}"; Tasks: desktopicon

[Run]
Filename: "{app}\{#MyExe}"; Description: "Launch Bull4x Terminal"; Flags: nowait postinstall skipifsilent
