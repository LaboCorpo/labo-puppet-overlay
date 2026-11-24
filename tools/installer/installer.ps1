# LaboHub installer (hand-made package: app.asar + this script). Reuses an Electron runtime already on the PC
# (LaboHub's own, or Puppet Overlay's), asks the language and the tabs, and lays the folder out:
#   %LOCALAPPDATA%\Programs\LaboHub\  app\ (the program)  Son Twitch\ (your sounds and GIFs)  LaboHub.lnk  LaboHub.ico  Desinstaller LaboHub.bat
# The choices go to %APPDATA%\LaboHub\setup.json, read once by LaboHub at start.
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Windows.Forms, System.Drawing
[System.Windows.Forms.Application]::EnableVisualStyles()

$Here = Split-Path -Parent $MyInvocation.MyCommand.Path
$Root = Join-Path $env:LOCALAPPDATA 'Programs\LaboHub'
$App = Join-Path $Root 'app'
$Media = Join-Path $Root 'Son Twitch'
$PuppetDir = Join-Path $env:LOCALAPPDATA 'Programs\puppet-overlay'
$UserData = Join-Path $env:APPDATA 'LaboHub'
$Version = '__VERSION__'

# ---------- Texts ----------
$T = @{
  fr = @{ title = "Installer LaboHub $Version"; lang = 'Langue'; tabs = 'Onglets à installer'; keep = 'Mise à jour : les onglets cochés sont ceux que tu as déjà.'; go = 'Installer'; cancel = 'Annuler'
    puppet = 'Puppet Overlay — ton salon vocal Discord en marionnettes'; hud = 'Widget Twitch — widgets OBS, compteurs de jeu, cam des copains, alertes'
    hub = 'Hub Labo — mon stream, streams des potes, multi-stream, clips'; deck = 'BabaDeck — Stream Deck à l''écran, raccourcis en jeu, OBS'; bababot = 'Baba Bot — bot de chat (commandes, messages, sons)'
    none = 'Coche au moins un onglet.'; noRuntime = "Il faut d'abord Puppet Overlay (ou une ancienne version de LaboHub) sur ce PC : LaboHub réutilise son moteur."
    noAsar = 'Le fichier app.asar manque à côté de ce script.'; working = 'Installation…'; done = 'LaboHub est installé. Lancement…'; failed = "L'installation a échoué :" }
  en = @{ title = "Install LaboHub $Version"; lang = 'Language'; tabs = 'Tabs to install'; keep = 'Update: the ticked tabs are the ones you already have.'; go = 'Install'; cancel = 'Cancel'
    puppet = 'Puppet Overlay — your Discord voice channel as puppets'; hud = 'Widget Twitch — OBS widgets, game counters, friends'' cams, alerts'
    hub = 'Hub Labo — my stream, friends'' streams, multi-stream, clips'; deck = 'BabaDeck — on-screen Stream Deck, shortcuts in game, OBS'; bababot = 'Baba Bot — chat bot (commands, messages, sounds)'
    none = 'Tick at least one tab.'; noRuntime = 'Puppet Overlay (or an older LaboHub) must be on this PC first: LaboHub reuses its engine.'
    noAsar = 'The app.asar file is missing next to this script.'; working = 'Installing…'; done = 'LaboHub is installed. Starting…'; failed = 'The installation failed:' }
}
$Groups = @('puppet', 'hud', 'hub', 'deck', 'bababot')

# Current choices of an existing install (language, tabs), to pre-fill the form.
$cur = $null
$cfgFile = Join-Path $UserData 'config.json'
if (Test-Path -LiteralPath $cfgFile) { try { $cur = (Get-Content -LiteralPath $cfgFile -Raw -Encoding UTF8 | ConvertFrom-Json).settings.app } catch { $cur = $null } }
$lang = 'fr'
if ($cur -and $cur.language -eq 'en') { $lang = 'en' } elseif (-not $cur -and (Get-Culture).TwoLetterISOLanguageName -ne 'fr') { $lang = 'en' }

# ---------- Window ----------
$f = New-Object System.Windows.Forms.Form
$f.StartPosition = 'CenterScreen'; $f.FormBorderStyle = 'FixedDialog'; $f.MaximizeBox = $false; $f.MinimizeBox = $false
$f.ClientSize = New-Object System.Drawing.Size(520, 430); $f.BackColor = [System.Drawing.Color]::FromArgb(33, 30, 40); $f.ForeColor = [System.Drawing.Color]::White
$f.Font = New-Object System.Drawing.Font('Segoe UI', 10)
$ico = Join-Path $Here 'LaboHub.ico'
$png = Join-Path $Here 'LaboHub.png'
# Pictures are only decoration: a file Windows cannot read never stops the installation.
try { if (Test-Path -LiteralPath $ico) { $f.Icon = New-Object System.Drawing.Icon($ico) } } catch { }
$logo = New-Object System.Windows.Forms.PictureBox
$logo.SizeMode = 'Zoom'; $logo.Location = '20,16'; $logo.Size = '56,56'
try { if (Test-Path -LiteralPath $png) { $logo.Image = [System.Drawing.Image]::FromFile($png) } } catch { }
$f.Controls.Add($logo)
$head = New-Object System.Windows.Forms.Label
$head.Location = '88,24'; $head.Size = '410,40'; $head.Font = New-Object System.Drawing.Font('Segoe UI', 15, [System.Drawing.FontStyle]::Bold)
$f.Controls.Add($head)

$lLang = New-Object System.Windows.Forms.Label; $lLang.Location = '20,88'; $lLang.Size = '480,22'; $lLang.ForeColor = [System.Drawing.Color]::FromArgb(164, 156, 179); $f.Controls.Add($lLang)
$rFr = New-Object System.Windows.Forms.RadioButton; $rFr.Text = 'Français'; $rFr.Location = '24,112'; $rFr.Size = '120,26'; $f.Controls.Add($rFr)
$rEn = New-Object System.Windows.Forms.RadioButton; $rEn.Text = 'English'; $rEn.Location = '150,112'; $rEn.Size = '120,26'; $f.Controls.Add($rEn)
if ($lang -eq 'fr') { $rFr.Checked = $true } else { $rEn.Checked = $true }

$lTabs = New-Object System.Windows.Forms.Label; $lTabs.Location = '20,152'; $lTabs.Size = '480,22'; $lTabs.ForeColor = [System.Drawing.Color]::FromArgb(164, 156, 179); $f.Controls.Add($lTabs)
$boxes = @{}
$y = 176
foreach ($g in $Groups) {
  $c = New-Object System.Windows.Forms.CheckBox
  $c.Location = "24,$y"; $c.Size = '480,28'
  $c.Checked = -not ($cur -and $cur.tabs -and $cur.tabs.$g -eq $false)
  $f.Controls.Add($c); $boxes[$g] = $c; $y += 32
}
$lKeep = New-Object System.Windows.Forms.Label; $lKeep.Location = '20,340'; $lKeep.Size = '480,22'; $lKeep.ForeColor = [System.Drawing.Color]::FromArgb(164, 156, 179); $lKeep.Visible = [bool]$cur; $f.Controls.Add($lKeep)
$status = New-Object System.Windows.Forms.Label; $status.Location = '20,372'; $status.Size = '260,44'; $status.ForeColor = [System.Drawing.Color]::FromArgb(255, 201, 60); $f.Controls.Add($status)
$bGo = New-Object System.Windows.Forms.Button; $bGo.Location = '400,378'; $bGo.Size = '100,34'; $bGo.FlatStyle = 'Flat'; $bGo.BackColor = [System.Drawing.Color]::FromArgb(255, 159, 28); $bGo.ForeColor = [System.Drawing.Color]::FromArgb(27, 16, 21); $bGo.Font = New-Object System.Drawing.Font('Segoe UI', 10, [System.Drawing.FontStyle]::Bold); $f.Controls.Add($bGo)
$bNo = New-Object System.Windows.Forms.Button; $bNo.Location = '290,378'; $bNo.Size = '100,34'; $bNo.FlatStyle = 'Flat'; $f.Controls.Add($bNo)
$f.AcceptButton = $bGo; $f.CancelButton = $bNo

function Texts {
  $L = $T[$(if ($rEn.Checked) { 'en' } else { 'fr' })]
  $f.Text = $L.title; $head.Text = $L.title; $lLang.Text = $L.lang; $lTabs.Text = $L.tabs; $lKeep.Text = $L.keep; $bGo.Text = $L.go; $bNo.Text = $L.cancel
  foreach ($g in $Groups) { $boxes[$g].Text = $L[$g] }
  return $L
}
$rFr.Add_CheckedChanged({ [void](Texts) }); $rEn.Add_CheckedChanged({ [void](Texts) })
$bNo.Add_Click({ $f.Close() })

# ---------- Install ----------
function Install($L) {
  if (-not (Test-Path -LiteralPath (Join-Path $Here 'app.asar'))) { throw $L.noAsar }
  Get-Process -Name 'LaboHub' -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
  Start-Sleep -Milliseconds 800
  New-Item -ItemType Directory -Force -Path $Root | Out-Null
  $old = Test-Path -LiteralPath (Join-Path $Root 'LaboHub.exe') # LaboHub 1.0–1.6 kept the program loose in this folder
  if (-not (Test-Path -LiteralPath (Join-Path $App 'LaboHub.exe'))) {
    New-Item -ItemType Directory -Force -Path $App | Out-Null
    if ($old) {
      foreach ($it in Get-ChildItem -LiteralPath $Root -Force) {
        if (@('app', 'Son Twitch', 'LaboHub.ico', 'LaboHub.lnk', 'Desinstaller LaboHub.bat') -contains $it.Name) { continue }
        Copy-Item -LiteralPath $it.FullName -Destination $App -Recurse -Force
      }
    } elseif (Test-Path -LiteralPath (Join-Path $PuppetDir 'Puppet Overlay.exe')) {
      foreach ($it in Get-ChildItem -LiteralPath $PuppetDir -Force) {
        if ($it.Name -eq 'resources' -or $it.Name -like 'Uninstall*' -or $it.Name -like 'LaboHub-installer*' -or $it.Name -eq 'Puppet Overlay.exe') { continue }
        Copy-Item -LiteralPath $it.FullName -Destination $App -Recurse -Force
      }
      Copy-Item -LiteralPath (Join-Path $PuppetDir 'Puppet Overlay.exe') -Destination (Join-Path $App 'LaboHub.exe') -Force
    } else { throw $L.noRuntime }
  }
  # The old loose program: only what app\ now holds is removed (never your own files).
  if ($old) {
    foreach ($it in Get-ChildItem -LiteralPath $App -Force) {
      $p = Join-Path $Root $it.Name
      if (Test-Path -LiteralPath $p) { Remove-Item -LiteralPath $p -Recurse -Force -ErrorAction SilentlyContinue }
    }
  }
  New-Item -ItemType Directory -Force -Path (Join-Path $App 'resources') | Out-Null
  Copy-Item -LiteralPath (Join-Path $Here 'app.asar') -Destination (Join-Path $App 'resources\app.asar') -Force
  Remove-Item -LiteralPath (Join-Path $App 'resources\app-update.bin') -Force -ErrorAction SilentlyContinue
  New-Item -ItemType Directory -Force -Path $Media | Out-Null
  foreach ($n in @('LaboHub.ico', 'Desinstaller LaboHub.bat')) { if (Test-Path -LiteralPath (Join-Path $Here $n)) { Copy-Item -LiteralPath (Join-Path $Here $n) -Destination $Root -Force } }
  # Choices read once by LaboHub.
  New-Item -ItemType Directory -Force -Path $UserData | Out-Null
  $tabs = [ordered]@{}; foreach ($g in $Groups) { $tabs[$g] = [bool]$boxes[$g].Checked }
  $setup = [ordered]@{ language = $(if ($rEn.Checked) { 'en' } else { 'fr' }); tabs = $tabs }
  [System.IO.File]::WriteAllText((Join-Path $UserData 'setup.json'), ($setup | ConvertTo-Json -Compress), (New-Object System.Text.UTF8Encoding($false)))
  # Shortcuts: desktop, Start menu, and one in the LaboHub folder.
  $sh = New-Object -ComObject WScript.Shell
  foreach ($d in @([Environment]::GetFolderPath('Desktop'), [Environment]::GetFolderPath('Programs'), $Root)) {
    $l = $sh.CreateShortcut((Join-Path $d 'LaboHub.lnk'))
    $l.TargetPath = Join-Path $App 'LaboHub.exe'; $l.WorkingDirectory = $App; $l.IconLocation = (Join-Path $Root 'LaboHub.ico') + ',0'; $l.Description = 'LaboHub'; $l.Save()
  }
}
$bGo.Add_Click({
  $L = Texts
  if (-not ($Groups | Where-Object { $boxes[$_].Checked })) { $status.Text = $L.none; return }
  $bGo.Enabled = $false; $bNo.Enabled = $false; $status.Text = $L.working; $f.Refresh()
  try {
    Install $L
    $status.Text = $L.done; $f.Refresh()
    Start-Process -FilePath (Join-Path $App 'LaboHub.exe') -WorkingDirectory $App
    Start-Sleep -Milliseconds 1200
    $f.Close()
  } catch {
    [System.Windows.Forms.MessageBox]::Show("$($L.failed)`n$($_.Exception.Message)", $L.title, 'OK', 'Error') | Out-Null
    $bGo.Enabled = $true; $bNo.Enabled = $true; $status.Text = ''
  }
})
[void](Texts)
[void]$f.ShowDialog()
