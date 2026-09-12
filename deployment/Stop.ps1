. (Join-Path $PSScriptRoot 'Common.ps1')
$config = Load-Installation
$port = if ($config.Mode -eq 'BackOffice') { 5443 } else { 5000 }
$listeners = Get-NetTCPConnection -State Listen -LocalPort $port -ErrorAction SilentlyContinue
if (!$listeners) { Write-Host 'Le serveur de ce poste est deja arrete.'; return }
foreach ($ownerId in ($listeners.OwningProcess | Select-Object -Unique)) {
    $process = Get-Process -Id $ownerId -ErrorAction Stop
    if ($process.Path -ne (Join-Path $PSScriptRoot 'Tresor.Api.exe')) {
        throw 'Le processus de ce port n appartient pas a ce dossier Tresor. Aucun arret effectue.'
    }
    Stop-Process -Id $ownerId -ErrorAction Stop
}
Write-Host 'Serveur de ce poste arrete. Utiliser 2-DEMARRER.cmd pour le relancer.'
