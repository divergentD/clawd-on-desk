!macro customInstall
  SetOutPath "$INSTDIR"
  File "/oname=$INSTDIR\uninstall-claude-hooks.ps1" "${BUILD_RESOURCES_DIR}\uninstall-claude-hooks.ps1"
  FileOpen $0 "$INSTDIR\.wang-pet-install-user-home" w
  FileWrite $0 "$PROFILE"
  FileClose $0
!macroend

!macro customUnInstall
  StrCpy $1 "$PROFILE"
  IfFileExists "$INSTDIR\.wang-pet-install-user-home" 0 wangpet_node_cleanup_home_done
    FileOpen $0 "$INSTDIR\.wang-pet-install-user-home" r
    FileRead $0 $1
    FileClose $0
  wangpet_node_cleanup_home_done:

  IfFileExists "$INSTDIR\wang-pet.exe" 0 wangpet_node_cleanup_done
  IfFileExists "$INSTDIR\resources\app.asar.unpacked\hooks\cleanup-integrations.js" 0 wangpet_node_cleanup_done
    System::Call 'Kernel32::SetEnvironmentVariable(t, t)i("ELECTRON_RUN_AS_NODE", "1").r0'
    nsExec::ExecToLog '"$INSTDIR\wang-pet.exe" "$INSTDIR\resources\app.asar.unpacked\hooks\cleanup-integrations.js" --apply --user-home "$1" --source nsis --fail-open'
    Pop $0
    System::Call 'Kernel32::SetEnvironmentVariable(t, t)i("ELECTRON_RUN_AS_NODE", "").r0'
  wangpet_node_cleanup_done:

  IfFileExists "$INSTDIR\uninstall-claude-hooks.ps1" 0 wangpet_uninstall_hooks_done
    nsExec::ExecToLog 'powershell.exe -NoProfile -NonInteractive -ExecutionPolicy Bypass -File "$INSTDIR\uninstall-claude-hooks.ps1" -InstallDir "$INSTDIR"'
    Pop $0
  wangpet_uninstall_hooks_done:
!macroend
