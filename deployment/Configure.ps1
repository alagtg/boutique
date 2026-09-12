. (Join-Path $PSScriptRoot 'Common.ps1')
$mode = (Get-Content -LiteralPath (Join-Path $PSScriptRoot 'poste.txt') -Raw).Trim()
if (Test-Path -LiteralPath (Join-Path $PSScriptRoot 'installation.clixml')) {
    throw 'Ce dossier est deja configure. Utiliser 2-DEMARRER.cmd. Ne pas reinitialiser une caisse existante.'
}
Write-Host "Installation Tresor : $mode"
Write-Host 'Utiliser le compte Windows qui utilisera la boutique au quotidien.'
$server = Read-Value 'Instance SQL locale' $(if ($mode -eq 'Commerce') { '.\SQLEXPRESS' } else { 'localhost' })
$database = Read-Value 'Nom de la base' $(if ($mode -eq 'Commerce') { 'CommerceDB' } else { '' })
if ([string]::IsNullOrWhiteSpace($database)) { throw 'Le nom exact de la base existante est obligatoire.' }
$builder = New-Object System.Data.SqlClient.SqlConnectionStringBuilder
$builder.DataSource = $server
$builder.InitialCatalog = $database
$builder.TrustServerCertificate = $true
$sqlUser = Read-Value 'Login SQL (laisser vide pour authentification Windows)'
if ($sqlUser) {
    $builder.UserID = $sqlUser
    $builder.Password = Get-PlainText (Read-Host 'Mot de passe SQL' -AsSecureString)
} else { $builder.IntegratedSecurity = $true }
$connection = $builder.ConnectionString
if ($mode -eq 'Commerce') { $builder.InitialCatalog = 'master' }
Test-LocalSqlConnection $builder.ConnectionString

Write-Host 'Choisir sur les deux PC exactement la meme phrase secrete (minimum 32 caracteres).'
$phrase = Get-PlainText (Read-Host 'Phrase secrete commune de synchronisation' -AsSecureString)
if ($phrase.Length -lt 32) { throw 'La phrase doit contenir au moins 32 caracteres.' }
$hash = [Security.Cryptography.SHA256]::Create()
try { $syncKey = [Convert]::ToBase64String($hash.ComputeHash([Text.Encoding]::UTF8.GetBytes($phrase))) }
finally { $hash.Dispose(); $phrase = $null }
$config = [ordered]@{
    Mode = $mode; NodeId = ''; Connection = $connection; SyncKey = $syncKey; JwtKey = (New-Secret)
    BackOfficeUrl = ''; BackupDirectory = ''; CertificatePassword = ''; BrowserUrl = ''
}

if ($mode -eq 'BackOffice') {
    $ip = Read-Value 'Adresse IPv4 fixe de ce PC sur le reseau (ex: 192.168.1.10)'
    $parsedIp = $null
    if (![Net.IPAddress]::TryParse($ip, [ref]$parsedIp) -or $parsedIp.AddressFamily -ne [Net.Sockets.AddressFamily]::InterNetwork) {
        throw 'Saisir une adresse IPv4 valide.'
    }
    $config.BackupDirectory = Read-Value 'Dossier de sauvegarde SQL (vide = dossier par defaut SQL Server)'
    Write-Host 'Fermer l ancienne API et suspendre les ventes avant cette operation.'
    $confirmation = Read-Value "Pour sauvegarder et adapter la base $database, retaper son nom"
    if ($confirmation -cne $database) { throw 'Nom non confirme : aucune migration effectuee.' }
    $config.CertificatePassword = New-Secret
    $certificate = New-SelfSignedCertificate -Type Custom -Subject "CN=Tresor-$ip" `
        -FriendlyName "Tresor LAN $ip" -CertStoreLocation 'Cert:\CurrentUser\My' `
        -KeyAlgorithm RSA -KeyLength 2048 -KeyExportPolicy Exportable `
        -KeyUsage DigitalSignature,KeyEncipherment -NotAfter (Get-Date).AddYears(2) `
        -TextExtension @("2.5.29.17={text}IPAddress=$ip&DNS=localhost&DNS=$env:COMPUTERNAME", '2.5.29.37={text}1.3.6.1.5.5.7.3.1')
    Export-PfxCertificate -Cert $certificate -FilePath (Join-Path $PSScriptRoot 'serveur.pfx') `
        -Password (ConvertTo-SecureString $config.CertificatePassword -AsPlainText -Force) | Out-Null
    $publicPath = Join-Path $PSScriptRoot 'CERTIFICAT-A-COPIER-SUR-CAISSE.cer'
    Export-Certificate -Cert $certificate -FilePath $publicPath | Out-Null
    Import-Certificate -FilePath $publicPath -CertStoreLocation 'Cert:\CurrentUser\Root' | Out-Null
    $config.BackOfficeUrl = "https://${ip}:5443"
    $config.BrowserUrl = 'https://localhost:5443'
    Set-InstallationEnvironment $config
    Invoke-ApplicationCommand '--adopt-existing-sqlserver'
    Write-Host "Certificat public a copier sur la caisse : $publicPath"
    Write-Host "Empreinte a comparer sur la caisse : $($certificate.Thumbprint)"
} else {
    $config.NodeId = Read-Value 'Nom stable de cette caisse' 'CAISSE-01'
    $config.BackOfficeUrl = (Read-Value 'Adresse HTTPS du PC principal (ex: https://192.168.1.10:5443)').TrimEnd('/')
    $remote = $null
    if (![Uri]::TryCreate($config.BackOfficeUrl, [UriKind]::Absolute, [ref]$remote) -or $remote.Scheme -ne 'https') {
        throw 'Utiliser l adresse HTTPS affichee sur le PC principal.'
    }
    $certificatePath = Read-Value 'Chemin du certificat .cer copie depuis le PC principal'
    $publicCertificate = New-Object Security.Cryptography.X509Certificates.X509Certificate2 $certificatePath
    Write-Host "Empreinte du certificat : $($publicCertificate.Thumbprint)"
    if ((Read-Value 'Empreinte identique a celle du PC principal ? taper OUI') -cne 'OUI') { throw 'Certificat non confirme.' }
    Import-Certificate -FilePath $certificatePath -CertStoreLocation 'Cert:\CurrentUser\Root' | Out-Null
    [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
    Invoke-RestMethod ($config.BackOfficeUrl + '/api/sync/health') -Headers @{ 'X-Sync-Key' = $syncKey } -TimeoutSec 10 | Out-Null
    $config.BrowserUrl = 'http://localhost:5000'
    Set-InstallationEnvironment $config
    Invoke-ApplicationCommand '--migrate-commerce'
    Invoke-ApplicationCommand '--provision-commerce'
}
Save-Installation $config
Write-Host "Configuration terminee. Ouvrir 2-DEMARRER.cmd puis $($config.BrowserUrl)"
Write-Host 'Les secrets sont chiffres pour ce compte Windows. Ne pas copier installation.clixml sur un autre PC.'
