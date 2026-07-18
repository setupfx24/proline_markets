; Inno Setup script for Proline Terminal.
; Built by scripts\package.ps1 (which passes StageDir / OutputDir / MyAppVersion).
; Produces a per-user installer (no admin needed to install) that adds Start-menu
; and optional desktop shortcuts and registers the prolineterminal:// URL scheme
; so the website's "Client Terminal" button can launch it when installed.

#define MyAppName "Proline Terminal"
#define MyAppPublisher "Proline Markets"
#define MyAppExeName "ProlineTerminal.exe"

#ifndef MyAppVersion
  #define MyAppVersion "0.1.0"
#endif
#ifndef StageDir
  #define StageDir "..\dist\stage"
#endif
#ifndef OutputDir
  #define OutputDir "..\dist"
#endif

[Setup]
AppId={{8F2A6C4B-9D1E-4A7F-B3C2-1E5D7A9B0C34}
AppName={#MyAppName}
AppVersion={#MyAppVersion}
AppPublisher={#MyAppPublisher}
DefaultDirName={autopf}\{#MyAppName}
DefaultGroupName={#MyAppName}
DisableProgramGroupPage=yes
UninstallDisplayIcon={app}\{#MyAppExeName}
OutputDir={#OutputDir}
OutputBaseFilename=ProlineTerminal-Setup
Compression=lzma2
SolidCompression=yes
WizardStyle=modern
ArchitecturesInstallIn64BitMode=x64compatible
; Per-user install so end users don't need administrator rights.
PrivilegesRequired=lowest

[Languages]
Name: "english"; MessagesFile: "compiler:Default.isl"

[Tasks]
Name: "desktopicon"; Description: "{cm:CreateDesktopIcon}"; GroupDescription: "{cm:AdditionalIcons}"

[Files]
Source: "{#StageDir}\*"; DestDir: "{app}"; Flags: recursesubdirs createallsubdirs ignoreversion

[Icons]
Name: "{group}\{#MyAppName}"; Filename: "{app}\{#MyAppExeName}"
Name: "{group}\{cm:UninstallProgram,{#MyAppName}}"; Filename: "{uninstallexe}"
Name: "{autodesktop}\{#MyAppName}"; Filename: "{app}\{#MyAppExeName}"; Tasks: desktopicon

[Registry]
; Register the prolineterminal:// URL protocol (per-user).
Root: HKCU; Subkey: "Software\Classes\prolineterminal"; ValueType: string; ValueName: ""; ValueData: "URL:Proline Terminal Protocol"; Flags: uninsdeletekey
Root: HKCU; Subkey: "Software\Classes\prolineterminal"; ValueType: string; ValueName: "URL Protocol"; ValueData: ""
Root: HKCU; Subkey: "Software\Classes\prolineterminal\DefaultIcon"; ValueType: string; ValueName: ""; ValueData: "{app}\{#MyAppExeName},0"
Root: HKCU; Subkey: "Software\Classes\prolineterminal\shell\open\command"; ValueType: string; ValueName: ""; ValueData: """{app}\{#MyAppExeName}"" ""%1"""

[Run]
Filename: "{app}\{#MyAppExeName}"; Description: "{cm:LaunchProgram,{#MyAppName}}"; Flags: nowait postinstall skipifsilent
