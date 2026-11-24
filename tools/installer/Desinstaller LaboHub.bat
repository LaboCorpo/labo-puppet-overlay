@echo off
chcp 65001 >nul
title Desinstallation de LaboHub
echo Cela supprime LaboHub et ses raccourcis. Tes reglages et timestamps restent dans %APPDATA%\LaboHub.
choice /M "Continuer"
if errorlevel 2 exit /b 0
set "ROOT=%LOCALAPPDATA%\Programs\LaboHub"
set "KEEP=1"
if exist "%ROOT%\Son Twitch" (
  choice /M "Supprimer aussi le dossier Son Twitch (tes sons et GIF)"
  if not errorlevel 2 set "KEEP=0"
)
taskkill /IM LaboHub.exe /F >nul 2>&1
timeout /t 1 /nobreak >nul
powershell -NoProfile -Command "foreach($d in @([Environment]::GetFolderPath('Desktop'), [Environment]::GetFolderPath('Programs'))){ Remove-Item -LiteralPath (Join-Path $d 'LaboHub.lnk') -ErrorAction SilentlyContinue }"
cd /d "%TEMP%"
rd /s /q "%ROOT%\app" >nul 2>&1
del /q "%ROOT%\LaboHub.lnk" "%ROOT%\LaboHub.ico" >nul 2>&1
if "%KEEP%"=="0" rd /s /q "%ROOT%\Son Twitch" >nul 2>&1
rem Last line on purpose: this script deletes itself (and the folder when it is empty), so cmd must not read further.
del /q "%ROOT%\Desinstaller LaboHub.bat" & rd "%ROOT%" >nul 2>&1 & echo LaboHub est desinstalle. & pause & exit /b 0
