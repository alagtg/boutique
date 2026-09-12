# Installation Commerce / BackOffice

## Architecture et analyse initiale

Le projet conserve Angular, ASP.NET Core 8, JWT, CORS, Swagger et les routes existantes.
Chaque processus ASP.NET Core ouvre **une seule** connexion locale :

```text
PC vente                         PC principal
Angular                          Angular (administration)
   |                                |
API, mode Commerce -- HTTPS --> API, mode BackOffice
   |                  sync          |
CommerceDB                       base existante / BackOfficeDB
```

`AppDbContext` reste la definition partagee du modele et le contrat injecte dans les
controllers existants. `CommerceDbContext` et `BackOfficeDbContext` en derivent.
L'injection choisit uniquement le contexte du poste. La caisse ne doit recevoir
ni les identifiants ni la connexion de la base du PC principal.

L'analyse a identifie :

1. `backend/Data/AppDbContext.cs` : contexte initial, utilise directement par tous les controllers et `DbSeeder`.
2. `backend/Models/Sale.cs`, `SaleLine.cs`, `SalePayment.cs` : vente, lignes et reglements ; relations vers `User`, `Customer`, `CashSession`, `ProductVariant`.
3. `backend/Controllers/SalesController.cs`, methode `Create` : calculs, stock, remise, paiement, fidelite et sauvegarde locale.
4. Aucun service de vente initial ; les effets client sont maintenant partages dans `CustomerSaleEffects`.
5. La configuration du checkout local utilisait `DefaultConnection=Data Source=tresor-boutique.db`. L'installation reelle indiquee par l'utilisateur utilise SQL Server : fournir sa connexion locale par variable d'environnement.
6. `backend/Program.cs` : ancienne initialisation `EnsureCreated`, SQL SQLite, donnees demo et remise a zero de couts au demarrage. Ces mutations ne sont plus lancees au demarrage normal.
7. Ancienne migration SQL Server `20260505110245_InitialClean`, conservee ; elle ne contient pas tous les ajouts plus recents.
8. Angular : `frontend/src/app/core/api.config.ts`, maintenant configurable par `frontend/src/assets/runtime-config.js`.
9. Surfaces impactees : ventes, stock, cumul client/fidelite, sessions de caisse, identification des references, autorisations, installation et demarrage.

Tables partagees : Roles, Permissions, RolePermissions, Users, UserSessions,
StoreSettings, Categories, Brands, Products, ProductVariants, ProductImages,
StockPurchases, Customers, LoyaltyAccounts, Vouchers, Registers, CashSessions,
Sales, SaleLines, SalePayments, Reservations, ReservationItems, ExpenseCategories,
Expenses, AuditLogs, Notifications.

Le schema est partage pour conserver les controllers et relations existants.
Commerce contient uniquement les references importees et ses operations locales :
les tables de gestion non utilisees y restent vides. Aucun historique central de
ventes, depenses, achats ou audit n'est importe.

## Garanties de synchronisation

- La vente, ses lignes, paiements, effets locaux et le JSON immuable `SyncPayload` sont enregistres dans la meme transaction locale.
- Le vendeur est identifie par le JWT, pas par le `UserId` envoye par Angular.
- Apres le commit, un signal reveille le worker sans attendre le reseau dans la requete de caisse.
- `SyncId` est un GUID avec index unique SQL ; `SaleNumber` inclut aussi un GUID.
- Le worker utilise un scope par passage et `IHttpClientFactory`, avec timeout de 5 secondes et reprise toutes les 30 secondes par defaut.
- Les echecs restent dans `Sales`, avec `IsSynced=false`, `SyncAttempts` et `LastSyncError`. Aucun effacement automatique.
- Le BackOffice applique vente, lignes, paiements, stock et fidelite dans une transaction ; l'index unique protege aussi les appels concurrents.
- Une reponse perdue apres commit ne cause pas de doublon. L'accuse de reception doit contenir le meme `SyncId`.
- Mapping : variante par `Barcode`, vendeur par `Username`, client par `QrCodeToken`, session par GUID, caisse par `NodeId/RegisterName`. Aucun ID numerique distant n'est reutilise.
- Le contenu original conserve les libelles/reference/couleur/taille au moment de la vente dans `SyncPayload`, meme si le catalogue change ensuite.
- Une reference produit/vendeur inconnue laisse la vente en attente ; corriger le catalogue central puis relancer.

## Preparatifs

Installer .NET 8 SDK, SQL Server et Node/npm si Angular doit etre compile.
Executer les commandes depuis la racine du projet. Le projet .NET est
`backend/Tresor.Api.csproj`. Utiliser une version 8.x de `dotnet-ef` compatible EF Core 8.

```powershell
dotnet tool install --global dotnet-ef --version 8.0.5
dotnet restore backend/Tresor.Api.csproj
dotnet build backend/Tresor.Api.csproj -c Release
```

Si `dotnet-ef` est deja installe, ne pas reinstaller aveuglement ; verifier `dotnet ef --version`.
Les commandes fournissent explicitement projet, startup et contexte.

Ne pas publier de mot de passe dans Git. `Jwt:Key` n'a plus de valeur embarquee.
Chaque poste doit avoir sa propre cle JWT de 32 octets minimum. La cle de
synchronisation est partagee entre les deux API, distincte des cles JWT.
Les comptes existants conservent leurs mots de passe. Le provisioning transfere
leurs empreintes BCrypt via l'API protegee afin de permettre la connexion hors ligne.
La cle technique donne donc acces a des donnees sensibles : utiliser HTTPS en production.
L'ancienne cle JWT de developpement avait ete versionnee : utiliser de nouvelles
cles a la mise en service, sans reprendre cette ancienne valeur.

Equivalent `appsettings` pour le **PC principal uniquement** (les secrets restent
dans les variables d'environnement, absents du JSON) :

```json
{
  "Database": { "Provider": "SqlServer", "BackupDirectory": "C:\\SQLBackups" },
  "Installation": { "Mode": "BackOffice" },
  "ConnectionStrings": {
    "BackOfficeConnection": "Server=localhost;Database=VOTRE_BASE_EXISTANTE;Trusted_Connection=True;TrustServerCertificate=True"
  },
  "BackOfficeApi": { "AllowInsecureHttp": false }
}
```

Equivalent pour le **PC vente uniquement** :

```json
{
  "Database": { "Provider": "SqlServer" },
  "Installation": { "Mode": "Commerce", "NodeId": "CAISSE-01" },
  "ConnectionStrings": {
    "CommerceConnection": "Server=localhost;Database=CommerceDB;Trusted_Connection=True;TrustServerCertificate=True"
  },
  "BackOfficeApi": {
    "BaseUrl": "https://pc-principal:5001",
    "TimeoutSeconds": 5,
    "IntervalSeconds": 30,
    "BatchSize": 50,
    "AllowInsecureHttp": false
  }
}
```

Fusionner ces sections avec la configuration existante du poste, en conservant
`Jwt:Issuer`, `Jwt:Audience`, CORS et les parametres de boutique. Les variables
d'environnement ont priorite sur le JSON ; ne pas copier la connexion principale sur la caisse.

Pour saisir une cle sans l'inscrire dans l'historique PowerShell :

```powershell
$syncSecret = Read-Host 'Cle de synchronisation commune aux deux API' -AsSecureString
$env:BackOfficeApi__SyncKey = [System.Net.NetworkCredential]::new('', $syncSecret).Password
$jwtSecret = Read-Host 'Cle JWT propre a ce poste' -AsSecureString
$env:Jwt__Key = [System.Net.NetworkCredential]::new('', $jwtSecret).Password
```

Ces variables concernent le processus PowerShell et ses enfants. Pour un service
Windows, les configurer dans son environnement ou un gestionnaire de secrets.
Ne pas utiliser la meme cle JWT entre installations : les IDs utilisateur locaux different.

## PC principal : conserver la base existante

Arreter l'ancienne API pour la bascule et suspendre les ecritures pendant la sauvegarde,
l'adoption et le provisioning initial. Ne pas supprimer ni renommer la base.
Son nom physique peut rester identique ; elle devient logiquement le BackOffice.

```powershell
$env:Database__Provider = 'SqlServer'
$env:Installation__Mode = 'BackOffice'
$env:ConnectionStrings__BackOfficeConnection = 'Server=localhost;Database=VOTRE_BASE_EXISTANTE;Trusted_Connection=True;TrustServerCertificate=True'
$env:Database__BackupDirectory = 'C:\SQLBackups'
```

Remplacer le serveur et le nom par ceux de votre installation, par exemple une
instance `localhost\SQL22`. Le repertoire de sauvegarde est situe sur **le serveur
SQL**, et son compte de service doit pouvoir y ecrire. Sans cette variable, le
repertoire de sauvegarde par defaut de SQL Server est utilise.

Sauvegarde manuelle possible dans SSMS, en etant connecte a la bonne instance :

```sql
BACKUP DATABASE [VOTRE_BASE_EXISTANTE]
TO DISK = N'C:\SQLBackups\Tresor-avant-deux-bases.bak'
WITH COPY_ONLY, CHECKSUM;
RESTORE VERIFYONLY FROM DISK = N'C:\SQLBackups\Tresor-avant-deux-bases.bak'
WITH CHECKSUM;
```

La commande d'adoption ci-dessous fait elle-meme une sauvegarde `COPY_ONLY` avec
nom unique puis `RESTORE VERIFYONLY` **avant toute modification de schema** :

```powershell
dotnet run --project backend/Tresor.Api.csproj -c Release --no-build -- --adopt-existing-sqlserver
```

Elle ajoute uniquement les champs/tables connus manquants, attribue les GUID aux
anciennes ventes/sessions, marque les anciennes ventes comme deja presentes,
verifie les colonnes attendues et enregistre la baseline du nouveau contexte.
Les tokens client dupliques ou trop longs provoquent un arret avec rollback.
L'ancienne table de migrations et ses lignes sont conservees. Tester d'abord
sur une restauration de la base reelle si son schema a ete modifie hors du projet.
Le test automatise couvre la structure de `InitialClean`, pas tous les schemas personnalises.

**Ne pas appliquer InitialBackOffice directement sur une base existante.**
Apres adoption, les migrations ulterieures utilisent :

```powershell
dotnet ef database update --context BackOfficeDbContext --project backend/Tresor.Api.csproj --startup-project backend/Tresor.Api.csproj --configuration Release
```

Pour une base BackOffice entierement nouvelle et vide seulement, utiliser directement
cette commande sans adoption, avec `BackOfficeConnection` pointant vers la nouvelle base.
Elle ne transfere pas l'historique d'une autre base.

## PC vente : creer CommerceDB

Sur le PC vente uniquement, fournir sa connexion SQL **locale** :

```powershell
$env:Database__Provider = 'SqlServer'
$env:Installation__Mode = 'Commerce'
$env:Installation__NodeId = 'CAISSE-01'
$env:ConnectionStrings__CommerceConnection = 'Server=localhost;Database=CommerceDB;Trusted_Connection=True;TrustServerCertificate=True'
$env:BackOfficeApi__BaseUrl = 'https://pc-principal:5001'
$env:BackOfficeApi__TimeoutSeconds = '5'
$env:BackOfficeApi__IntervalSeconds = '30'
dotnet ef database update --context CommerceDbContext --project backend/Tresor.Api.csproj --startup-project backend/Tresor.Api.csproj --configuration Release
```

`NodeId` doit rester stable et etre different pour chaque caisse.
`BaseUrl` est l'origine de l'API, **sans `/api`**. Ne pas mettre `localhost`
pour joindre le PC principal. Ne jamais fournir `BackOfficeConnection` a la caisse.

Une fois le BackOffice demarre et avant de vendre :

```powershell
dotnet run --project backend/Tresor.Api.csproj -c Release --no-build -- --provision-commerce
```

Le provisioning refuse une CommerceDB deja peuplee ; il ne remplace pas les donnees.
Il importe catalogue, parametres, comptes actifs, clients et fidelite, remappe les
IDs locaux et cree une caisse portant `NodeId`. Aucun historique de vente ou depense.
Les images restent des chemins : copier aussi les fichiers de `backend/wwwroot`
et les assets Angular sur le poste de vente pour une disponibilite hors ligne.

## Demarrer les deux API et ouvrir le reseau

Configuration HTTP de test LAN, correspondant aux IP de l'exemple :

Sur le PC principal (192.168.1.10), avec les variables BackOffice precedentes :

```powershell
$env:BackOfficeApi__AllowInsecureHttp = 'true'
$env:ASPNETCORE_URLS = 'http://0.0.0.0:5000'
dotnet run --project backend/Tresor.Api.csproj -c Release --no-build
```

Sur le PC vente (192.168.1.20), avec les variables Commerce precedentes :

```powershell
$env:BackOfficeApi__BaseUrl = 'http://192.168.1.10:5000'
$env:BackOfficeApi__AllowInsecureHttp = 'true'
$env:ASPNETCORE_URLS = 'http://localhost:5000'
dotnet run --project backend/Tresor.Api.csproj -c Release --no-build
```

HTTP n'est pas chiffre, meme avec `X-Sync-Key`. L'option est explicite pour les tests.
En production, retirer `AllowInsecureHttp`, configurer un certificat HTTPS valide et
approuve sur les postes, puis utiliser `https://pc-principal:5001`. Le certificat
doit couvrir le nom utilise ; ne pas desactiver la validation du certificat dans HttpClient.
Kestrel se configure avec `ASPNETCORE_URLS` et
`Kestrel__Certificates__Default__Path` / `Kestrel__Certificates__Default__Password`.

Regle Windows Firewall sur le PC principal, PowerShell administrateur, exemple HTTP :

```powershell
New-NetFirewallRule -DisplayName 'Tresor API depuis caisse' -Direction Inbound -Action Allow -Protocol TCP -LocalPort 5000 -RemoteAddress 192.168.1.20 -Profile Private
```

Utiliser le port 5001 pour HTTPS. Ne pas ouvrir le port SQL Server entre les PC.
La caisse ecoute sur localhost si son navigateur est sur la meme machine.

## Angular

Chaque Angular parle uniquement a l'API de son installation. Modifier
`frontend/src/assets/runtime-config.js`, ou le fichier correspondant apres build :

```javascript
window.tresorConfig = { apiUrl: 'http://localhost:5000/api' };
```

Depuis un autre ordinateur, mettre l'adresse de **cette** installation, par exemple
`http://192.168.1.10:5000/api` pour l'administration centrale. Utiliser HTTPS pour
une page HTTPS. Sans valeur explicite, le nom d'hote de la page et le port 5000
sont utilises. Aucune chaine SQL dans Angular.

```powershell
Set-Location frontend
npm ci
npm start
```

Angular : `http://localhost:4200`. Une fois connecte comme employe, utiliser
`/employee/pos`. L'administration centrale s'ouvre sur l'Angular du PC principal.
Les protections sont appliquees par l'API : rapports/depenses/achats reserves a ADMIN,
ecriture catalogue reservee a ADMIN sur le BackOffice, diagnostic/retry reserves a ADMIN.

## Diagnostic depuis le deuxieme PC

```powershell
Test-NetConnection 192.168.1.10 -Port 5000
Invoke-RestMethod 'http://192.168.1.10:5000/api/sync/health' -Headers @{ 'X-Sync-Key' = $env:BackOfficeApi__SyncKey }
```

Se connecter en admin a l'API locale pour obtenir un JWT, puis :

```powershell
$adminPassword = Read-Host 'Mot de passe admin local' -AsSecureString
$loginBody = @{ username = 'admin'; password = [System.Net.NetworkCredential]::new('', $adminPassword).Password } | ConvertTo-Json
$login = Invoke-RestMethod 'http://localhost:5000/api/auth/login' -Method Post -ContentType 'application/json' -Body $loginBody
$headers = @{ Authorization = "Bearer $($login.token)" }
Invoke-RestMethod 'http://localhost:5000/api/sync/status' -Headers $headers
Invoke-RestMethod 'http://localhost:5000/api/sync/pending' -Headers $headers
Invoke-RestMethod 'http://localhost:5000/api/sync/retry' -Method Post -Headers $headers
```

Adapter le nom du compte. `status` retourne `mode`, `pending`, `lastSuccessfulSync`
et `backOfficeReachable`. `pending` montre les 200 premieres ventes en attente avec
tentatives/erreur. `retry` repond 202 et reveille le worker ; verifier ensuite le statut.

Dans SSMS sur chaque base locale :

```sql
SELECT SyncId, SaleNumber, IsSynced, SyncedAt, SyncAttempts, LastSyncError
FROM dbo.Sales ORDER BY Id DESC;
SELECT SyncId, COUNT(*) AS Nombre FROM dbo.Sales GROUP BY SyncId HAVING COUNT(*) > 1;
```

Comparer le meme `SyncId` sur Commerce et BackOffice ; verifier les `SaleLines` et
`SalePayments` par le **SaleId local de chaque base**. La seconde requete doit etre vide.

## Portee et exploitation

Cette livraison synchronise automatiquement les **nouvelles ventes** de Commerce
vers BackOffice. Les reservations, changements clients sans vente, depenses et
fermetures de caisse ulterieures ne sont pas une replication bidirectionnelle.
La session transmise represente son etat au moment de la vente.

Le provisioning initial est un instantane. Les modifications ulterieures du catalogue,
des comptes, du stock central ou de la fidelite ne sont pas automatiquement redescendues.
Planifier leur mise a jour avant une exploitation reguliere ; ne pas recreer CommerceDB
pour rafraichir les references, car elle contient les ventes locales. Les barcodes et
usernames deja utilises doivent rester stables. Un seul stock initial est copie : ce
mecanisme ne constitue pas une allocation de stock multi-caisses.

Le mode `Standalone` reste disponible pour une installation a une base. Le fichier
SQLite existant n'a pas ete migre par cette intervention. Pour une copie SQLite recente,
`--initialize-sqlite` ajoute les champs de synchronisation avec sauvegarde SQLite ;
les migrations generees sont SQL Server, pas SQLite.
Les donnees demo sont desormais explicites : `--seed-demo` uniquement en Standalone,
avec `Seed__AdminPassword` et `Seed__EmployeePassword` si les comptes n'existent pas.

## Verification realisee

Tests d'integration utilisant deux vrais processus API, SQL Server local et des bases
temporaires prefixees `TresorSyncTest_` :

1. Vente locale puis reception centrale.
2. Deux ventes avec BackOffice arrete, conservees avec erreurs/tentatives.
3. Reprise automatique apres redemarrage du BackOffice.
4. Rejeu de la meme vente sans doublon.
5. Proxy coupant la reponse apres commit distant, puis reprise sans double stock/fidelite.
6. Redemarrage de Commerce avec des ventes en attente.
7. Lignes, paiements, remise, client, vendeur, caisse avec IDs numeriques volontairement differents.
8. Refus des endpoints ADMIN au vendeur et protection de la cle technique.

Test supplementaire : base creee par `InitialClean`, vente existante, sauvegarde
verifiee, adoption BackOffice et seconde adoption sans perte ni duplication.

```powershell
dotnet build tests/SyncSmoke/SyncSmoke.csproj --configuration Sync
dotnet tests/SyncSmoke/bin/Sync/net8.0/SyncSmoke.dll .
```

Le compte Windows doit pouvoir creer et sauvegarder des **bases de test** sur SQL
Server local. `SYNC_TEST_SQL_SERVER` permet de choisir une autre instance de test.
Les processus temporaires sont arretes en fin de test ; les bases restent inspectables.
Ces tests ne remplacent pas un essai sur votre reseau entre les deux vrais PC.

## Migrations et fichiers

Migrations nouvelles :

- `backend/Migrations/Commerce/20260912110045_InitialCommerce.cs` et `.Designer.cs`.
- `backend/Migrations/Commerce/CommerceDbContextModelSnapshot.cs`.
- `backend/Migrations/BackOffice/20260912110139_InitialBackOffice.cs` et `.Designer.cs`.
- `backend/Migrations/BackOffice/BackOfficeDbContextModelSnapshot.cs`.

Pour une evolution ulterieure, apres modification des modeles, sur une configuration SQL Server :

```powershell
dotnet ef migrations add NomEvolution --context CommerceDbContext --project backend/Tresor.Api.csproj --startup-project backend/Tresor.Api.csproj --output-dir Migrations/Commerce
dotnet ef migrations add NomEvolution --context BackOfficeDbContext --project backend/Tresor.Api.csproj --startup-project backend/Tresor.Api.csproj --output-dir Migrations/BackOffice
```

L'inventaire exact des fichiers source est dans `docs/FICHIERS-DEUX-BASES.md`.
