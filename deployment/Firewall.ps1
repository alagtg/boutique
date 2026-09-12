$ErrorActionPreference = 'Stop'
$ruleName = 'Tresor-BackOffice-HTTPS'
if (!(Get-NetFirewallRule -Name $ruleName -ErrorAction SilentlyContinue)) {
    New-NetFirewallRule -Name $ruleName -DisplayName 'Tresor BackOffice HTTPS LAN' -Direction Inbound `
        -Action Allow -Protocol TCP -LocalPort 5443 -RemoteAddress LocalSubnet -Profile Private | Out-Null
}
Write-Host 'HTTPS port 5443 autorise depuis le reseau local prive. Aucun port SQL ouvert.'
