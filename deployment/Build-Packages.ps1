$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.IO.Compression
Add-Type -AssemblyName System.IO.Compression.FileSystem
$root = Split-Path $PSScriptRoot -Parent
$stamp = (Get-Date -Format 'yyyyMMdd-HHmmss') + '-' + [Guid]::NewGuid().ToString('N').Substring(0, 6)
$output = Join-Path $root ".local\deploiement-$stamp"
$publish = Join-Path $output '_publish'
New-Item -ItemType Directory -Path $output | Out-Null
Push-Location (Join-Path $root 'frontend')
try {
    & node 'node_modules/@angular/cli/bin/ng.js' build
    if ($LASTEXITCODE -ne 0) { throw 'Compilation Angular echouee.' }
} finally { Pop-Location }
& dotnet publish (Join-Path $root 'backend/Tresor.Api.csproj') -c Release -r win-x64 --self-contained true -p:DeploymentPackage=true -o $publish
if ($LASTEXITCODE -ne 0) { throw 'Publication .NET echouee.' }
$frontend = Join-Path $root 'frontend/dist/tresor-boutique/browser'
$manifest = @()
foreach ($entry in @(@{ Folder='PC-Principal'; Mode='BackOffice' }, @{ Folder='PC-Caisse'; Mode='Commerce' })) {
    $target = Join-Path $output $entry.Folder
    New-Item -ItemType Directory -Path $target | Out-Null
    Get-ChildItem -LiteralPath $publish | ForEach-Object { Copy-Item -LiteralPath $_.FullName -Destination $target -Recurse }
    $wwwroot = Join-Path $target 'wwwroot'
    New-Item -ItemType Directory -Path $wwwroot -Force | Out-Null
    Get-ChildItem -LiteralPath $frontend | ForEach-Object { Copy-Item -LiteralPath $_.FullName -Destination $wwwroot -Recurse -Force }
    Copy-Item -LiteralPath (Join-Path $PSScriptRoot 'runtime-config.js') -Destination (Join-Path $wwwroot 'assets/runtime-config.js') -Force
    Get-ChildItem -LiteralPath $PSScriptRoot -File | Where-Object { ($_.Extension -eq '.ps1' -and $_.Name -ne 'Build-Packages.ps1') -or $_.Extension -eq '.cmd' } |
        ForEach-Object { Copy-Item -LiteralPath $_.FullName -Destination $target }
    $entry.Mode | Set-Content -LiteralPath (Join-Path $target 'poste.txt') -Encoding ASCII
    Copy-Item -LiteralPath (Join-Path $root 'docs/INSTALLATION-DEUX-PC.md') -Destination (Join-Path $target 'LISEZ-MOI.md')
    Copy-Item -LiteralPath (Join-Path $root 'docs/ETIQUETTES-DOUCHETTE.md') -Destination $target
    $uploads = Join-Path $root 'backend/wwwroot/uploads'
    if ($entry.Mode -eq 'BackOffice' -and (Test-Path -LiteralPath $uploads)) {
        Copy-Item -LiteralPath $uploads -Destination $wwwroot -Recurse -Force
    } elseif (Test-Path -LiteralPath (Join-Path $uploads 'products')) {
        $targetUploads = Join-Path $wwwroot 'uploads'
        New-Item -ItemType Directory -Path $targetUploads -Force | Out-Null
        Copy-Item -LiteralPath (Join-Path $uploads 'products') -Destination $targetUploads -Recurse -Force
    }
    $unexpected = Get-ChildItem -LiteralPath $target -Recurse -File | Where-Object { $_.Extension -in '.db','.clixml','.pfx','.log' }
    if ($unexpected) { throw 'Fichiers locaux inattendus dans le paquet. Publication interrompue.' }
    $zip = Join-Path $output ($entry.Folder + '.zip')
    $archive = [IO.Compression.ZipFile]::Open($zip, [IO.Compression.ZipArchiveMode]::Create)
    try {
        Get-ChildItem -LiteralPath $target -File -Recurse | ForEach-Object {
            $relative = $_.FullName.Substring($target.Length + 1).Replace('\', '/')
            [IO.Compression.ZipFileExtensions]::CreateEntryFromFile($archive, $_.FullName, ($entry.Folder + '/' + $relative)) | Out-Null
        }
    } finally { $archive.Dispose() }
    $manifest += [pscustomobject]@{ File = (Split-Path $zip -Leaf); Bytes = (Get-Item $zip).Length; SHA256 = (Get-FileHash -LiteralPath $zip -Algorithm SHA256).Hash }
}
$manifest | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $output 'SHA256.json') -Encoding UTF8
Write-Output "DOSSIER_DEPLOIEMENT=$output"
$manifest | Format-Table
