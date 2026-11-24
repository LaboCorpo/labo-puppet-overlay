@echo off
rem LaboHub installer: the window (language, tabs) is installer.ps1, next to this file.
powershell -NoProfile -ExecutionPolicy Bypass -STA -WindowStyle Hidden -File "%~dp0installer.ps1"
if errorlevel 1 (
  echo L'installateur n'a pas pu demarrer. Clic droit sur installer.ps1 ^> Executer avec PowerShell.
  pause
)
