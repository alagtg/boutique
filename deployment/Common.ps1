$ErrorActionPreference = 'Stop'

function Read-Value([string]$Label, [string]$Default = '') {
    $value = Read-Host "$Label [$Default]"
    if ([string]::IsNullOrWhiteSpace($value)) { return $Default }
    return $value.Trim()
}

function Get-PlainText([Security.SecureString]$Value) {
    return [Net.NetworkCredential]::new('', $Value).Password
}

function New-Secret {
    $bytes = New-Object byte[] 32
    $rng = [Security.Cryptography.RandomNumberGenerator]::Create()
    try { $rng.GetBytes($bytes) } finally { $rng.Dispose() }
    return [Convert]::ToBase64String($bytes)
}

function Save-Installation($Config) {
    $Config | ConvertTo-Json -Depth 8 | ConvertTo-SecureString -AsPlainText -Force |
        Export-Clixml -LiteralPath (Join-Path $PSScriptRoot 'installation.clixml')
}

function Load-Installation {
    $path = Join-Path $PSScriptRoot 'installation.clixml'
    if (!(Test-Path -LiteralPath $path)) { throw 'Executer d abord 1-CONFIGURER.cmd.' }
    $secure = Import-Clixml -LiteralPath $path
    return (Get-PlainText $secure) | ConvertFrom-Json
}

function Set-InstallationEnvironment($Config) {
    $env:ASPNETCORE_ENVIRONMENT = 'Production'
    $env:Database__Provider = 'SqlServer'
    $env:Installation__Mode = $Config.Mode
    $env:Installation__NodeId = $Config.NodeId
    $env:ConnectionStrings__CommerceConnection = $null
    $env:ConnectionStrings__BackOfficeConnection = $null
    if ($Config.Mode -eq 'Commerce') { $env:ConnectionStrings__CommerceConnection = $Config.Connection }
    else { $env:ConnectionStrings__BackOfficeConnection = $Config.Connection }
    $env:Jwt__Key = $Config.JwtKey
    $env:BackOfficeApi__SyncKey = $Config.SyncKey
    $env:BackOfficeApi__BaseUrl = $Config.BackOfficeUrl
    $env:BackOfficeApi__AllowInsecureHttp = 'false'
    $env:BackOfficeApi__TimeoutSeconds = '5'
    $env:BackOfficeApi__IntervalSeconds = '30'
    $env:Database__BackupDirectory = $Config.BackupDirectory
    $env:Kestrel__Certificates__Default__Path = $null
    $env:Kestrel__Certificates__Default__Password = $null
    if ($Config.Mode -eq 'BackOffice') {
        $env:ASPNETCORE_URLS = 'https://0.0.0.0:5443'
        $env:Kestrel__Certificates__Default__Path = Join-Path $PSScriptRoot 'serveur.pfx'
        $env:Kestrel__Certificates__Default__Password = $Config.CertificatePassword
    } else { $env:ASPNETCORE_URLS = 'http://localhost:5000' }
}

function Invoke-ApplicationCommand([string]$Argument) {
    Push-Location $PSScriptRoot
    try {
        & (Join-Path $PSScriptRoot 'Tresor.Api.exe') $Argument
        if ($LASTEXITCODE -ne 0) { throw "La commande $Argument a echoue. Ne pas continuer avant correction." }
    } finally { Pop-Location }
}

function Test-LocalSqlConnection([string]$Connection) {
    $sql = New-Object System.Data.SqlClient.SqlConnection $Connection
    try { $sql.Open() } finally { $sql.Dispose() }
}
