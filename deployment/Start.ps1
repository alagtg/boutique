param([switch]$NoBrowser)
. (Join-Path $PSScriptRoot 'Common.ps1')
$config = Load-Installation
Set-InstallationEnvironment $config
$port = if ($config.Mode -eq 'BackOffice') { 5443 } else { 5000 }
$existing = Get-NetTCPConnection -State Listen -LocalPort $port -ErrorAction SilentlyContinue
if ($existing) {
    $owner = Get-Process -Id $existing[0].OwningProcess -ErrorAction Stop
    if ($owner.Path -ne (Join-Path $PSScriptRoot 'Tresor.Api.exe')) {
        throw "Le port $port est deja utilise par une autre application. Fermer cette application avant de lancer Tresor."
    }
} else {
    Start-Process -FilePath (Join-Path $PSScriptRoot 'Tresor.Api.exe') -WorkingDirectory $PSScriptRoot `
        -WindowStyle Hidden -RedirectStandardOutput (Join-Path $PSScriptRoot 'serveur.log') `
        -RedirectStandardError (Join-Path $PSScriptRoot 'serveur-erreur.log') | Out-Null
}
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
$ready = $false
for ($attempt = 0; $attempt -lt 30; $attempt++) {
    try {
        Invoke-RestMethod ($config.BrowserUrl + '/api/settings/store') -TimeoutSec 2 | Out-Null
        $ready = $true
        break
    } catch { Start-Sleep -Seconds 1 }
}
if (!$ready) { throw 'Le serveur ne demarre pas. Consulter serveur.log et serveur-erreur.log dans ce dossier.' }
if (!$NoBrowser) { Start-Process $config.BrowserUrl }
Write-Host "Tresor disponible : $($config.BrowserUrl)"
