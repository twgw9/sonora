; Sonora — Windows installer
; Built with makensis on any platform. Produces a single .exe that installs
; to %LOCALAPPDATA%, creates shortcuts, and registers an uninstaller.

Unicode true
SetCompressor /SOLID lzma
SetCompressorDictSize 64

!define APP "Sonora"
!define COMPANY "Sonora"
!define EXE "Sonora.exe"
!define VER "1.0.0"
!define REGKEY "Software\Microsoft\Windows\CurrentVersion\Uninstall\Sonora"

Name "${APP}"
OutFile "out\SonoraSetup.exe"
InstallDir "$LOCALAPPDATA\Programs\Sonora"
InstallDirRegKey HKCU "Software\Sonora" "InstallDir"
RequestExecutionLevel user
ShowInstDetails hide
ShowUninstDetails hide
BrandingText "${APP} ${VER}"

!include "MUI2.nsh"

!define MUI_ABORTWARNING
!define MUI_ICON "assets\app.ico"
!define MUI_UNICON "assets\app.ico"
!define MUI_FINISHPAGE_RUN "$INSTDIR\${EXE}"
!define MUI_FINISHPAGE_RUN_TEXT "Open Sonora"
!define MUI_WELCOMEPAGE_TITLE "Install ${APP}"
!define MUI_WELCOMEPAGE_TEXT "A music player with a real seven-band equaliser, sixteen studio sound modes, offline downloads and synced listening rooms.$\r$\n$\r$\nNo account. Nothing stored on a server.$\r$\n$\r$\nSonora installs for the current user, so no administrator rights are needed."

!insertmacro MUI_PAGE_WELCOME
!insertmacro MUI_PAGE_DIRECTORY
!insertmacro MUI_PAGE_INSTFILES
!insertmacro MUI_PAGE_FINISH

!insertmacro MUI_UNPAGE_CONFIRM
!insertmacro MUI_UNPAGE_INSTFILES

!insertmacro MUI_LANGUAGE "English"

Section "Sonora"
  SetOutPath "$INSTDIR"

  ; stop a running copy so files are not locked
  nsExec::Exec 'taskkill /F /IM ${EXE}'

  File /r "out\win-unpacked\*.*"

  WriteRegStr HKCU "Software\Sonora" "InstallDir" "$INSTDIR"
  WriteUninstaller "$INSTDIR\Uninstall.exe"

  CreateShortcut "$SMPROGRAMS\${APP}.lnk" "$INSTDIR\${EXE}"
  CreateShortcut "$DESKTOP\${APP}.lnk" "$INSTDIR\${EXE}"

  ; sonora:// links open the app
  WriteRegStr HKCU "Software\Classes\sonora" "" "URL:Sonora"
  WriteRegStr HKCU "Software\Classes\sonora" "URL Protocol" ""
  WriteRegStr HKCU "Software\Classes\sonora\shell\open\command" "" '"$INSTDIR\${EXE}" "%1"'

  ; Add or remove programs
  WriteRegStr HKCU "${REGKEY}" "DisplayName" "${APP}"
  WriteRegStr HKCU "${REGKEY}" "DisplayVersion" "${VER}"
  WriteRegStr HKCU "${REGKEY}" "Publisher" "${COMPANY}"
  WriteRegStr HKCU "${REGKEY}" "DisplayIcon" "$INSTDIR\${EXE}"
  WriteRegStr HKCU "${REGKEY}" "UninstallString" '"$INSTDIR\Uninstall.exe"'
  WriteRegStr HKCU "${REGKEY}" "InstallLocation" "$INSTDIR"
  WriteRegDWORD HKCU "${REGKEY}" "NoModify" 1
  WriteRegDWORD HKCU "${REGKEY}" "NoRepair" 1

  WriteRegDWORD HKCU "${REGKEY}" "EstimatedSize" 212000
SectionEnd

Section "Uninstall"
  nsExec::Exec 'taskkill /F /IM ${EXE}'
  Delete "$SMPROGRAMS\${APP}.lnk"
  Delete "$DESKTOP\${APP}.lnk"
  RMDir /r "$INSTDIR"
  DeleteRegKey HKCU "Software\Sonora"
  DeleteRegKey HKCU "Software\Classes\sonora"
  DeleteRegKey HKCU "${REGKEY}"
SectionEnd
