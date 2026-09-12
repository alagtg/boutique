. (Join-Path $PSScriptRoot 'Common.ps1')
$config = Load-Installation
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
$username = Read-Value 'Nom du compte administrateur' 'admin'
$password = Get-PlainText (Read-Host 'Mot de passe administrateur de la boutique' -AsSecureString)
$body = @{ username = $username; password = $password } | ConvertTo-Json
$login = Invoke-RestMethod ($config.BrowserUrl + '/api/auth/login') -Method Post -ContentType 'application/json' -Body $body
$headers = @{ Authorization = "Bearer $($login.token)" }
Invoke-RestMethod ($config.BrowserUrl + '/api/sync/status') -Headers $headers | Format-List
if ($config.Mode -eq 'Commerce') {
    Invoke-RestMethod ($config.BrowserUrl + '/api/sync/pending') -Headers $headers | Format-Table
    if ((Read-Value 'Relancer les ventes en attente ? OUI/NON' 'NON') -eq 'OUI') {
        Invoke-RestMethod ($config.BrowserUrl + '/api/sync/retry') -Method Post -Headers $headers | Format-List
    }
}
