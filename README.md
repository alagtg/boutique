# Tresor Boutique

Application Angular et ASP.NET Core 8 pour la caisse et la gestion de boutique.

## Deux bases SQL Server

Le mode Commerce enregistre les ventes localement et les transmet automatiquement
au mode BackOffice par API protegee, avec reprise hors ligne et protection contre
les doublons. Les modeles et routes de l'application existante sont conserves.

Voir [le guide de migration et de deploiement](docs/DEUX-BASES.md) pour la sauvegarde,
les commandes EF, les variables d'environnement, les ports, le pare-feu et les tests.
L'[inventaire des fichiers](docs/FICHIERS-DEUX-BASES.md) detaille la modification.

Ne jamais supprimer la base existante pour installer cette version.
Ne pas appliquer une migration initiale sur une base deja peuplee : utiliser la
procedure d'adoption avec sauvegarde decrite dans le guide.

## Demarrage

Configurer la connexion locale, le mode d'installation et `Jwt__Key` avant de lancer
le backend. En mode Commerce/BackOffice, configurer aussi `BackOfficeApi__SyncKey`.
Les comptes existants conservent leurs mots de passe ; aucun mot de passe n'est
cree au demarrage normal. Les donnees de demonstration sont desormais explicites.

```powershell
dotnet run --project backend/Tresor.Api.csproj
```

Dans le dossier frontend :

```powershell
npm ci
npm start
```

Interface : http://localhost:4200. API locale habituelle : http://localhost:5000.
L'adresse de l'API de chaque poste se configure dans
`frontend/src/assets/runtime-config.js`.

## Verification

```powershell
dotnet build tests/SyncSmoke/SyncSmoke.csproj --configuration Sync
dotnet tests/SyncSmoke/bin/Sync/net8.0/SyncSmoke.dll .
```

Les tests creent des bases SQL Server isolees, valident la reprise de l'ancien
schema et les huit scenarios de synchronisation. Voir les prerequis dans le guide.
