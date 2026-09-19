# Fichiers de la modification deux bases

Fichiers crees :

- `.gitignore`
- `backend/Controllers/SyncController.cs`
- `backend/DTOs/CommerceReferenceDto.cs`
- `backend/DTOs/SaleSyncDto.cs`
- `backend/Data/BackOfficeDbContext.cs`
- `backend/Data/CommerceDbContext.cs`
- `backend/Data/ContextConfiguration.cs`
- `backend/Data/SqliteTransition.cs`
- `backend/Data/SqlServerTransition.cs`
- `backend/Services/CommerceProvisioningService.cs`
- `backend/Services/CustomerSaleEffects.cs`
- `backend/Services/InstallationAccessFilter.cs`
- `backend/Services/InstallationOptions.cs`
- `backend/Services/SaleSyncPayloadFactory.cs`
- `backend/Services/SalesSyncBackgroundService.cs`
- `backend/Services/SalesSyncReceiver.cs`
- `backend/Services/SalesSyncService.cs`
- `backend/Services/SyncKeyAuthenticationHandler.cs`
- `backend/Migrations/Commerce/20260912110045_InitialCommerce.cs`
- `backend/Migrations/Commerce/20260912110045_InitialCommerce.Designer.cs`
- `backend/Migrations/Commerce/CommerceDbContextModelSnapshot.cs`
- `backend/Migrations/BackOffice/20260912110139_InitialBackOffice.cs`
- `backend/Migrations/BackOffice/20260912110139_InitialBackOffice.Designer.cs`
- `backend/Migrations/BackOffice/BackOfficeDbContextModelSnapshot.cs`
- `frontend/src/assets/runtime-config.js`
- `tests/SyncSmoke/SyncSmoke.csproj`
- `tests/SyncSmoke/Program.cs`
- `docs/DEUX-BASES.md`
- `docs/FICHIERS-DEUX-BASES.md`

Fichiers modifies :

- `README.md`
- `backend/Controllers/SalesController.cs`
- `backend/Controllers/ProductsController.cs`
- `backend/Data/AppDbContext.cs`
- `backend/Data/DbSeeder.cs`
- `backend/Models/Sale.cs`
- `backend/Models/CashSession.cs`
- `backend/Program.cs`
- `backend/appsettings.json`
- `frontend/src/app/core/api.config.ts`
- `frontend/src/index.html`

Complement installation Windows et etiquettes :

- `deployment/` : construction des deux archives, configuration chiffree, demarrage,
  verification, arret, tache de connexion Windows et pare-feu.
- `docs/INSTALLATION-DEUX-PC.md` et `docs/ETIQUETTES-DOUCHETTE.md`.
- `backend/Services/CatalogueSyncService.cs` : nouveaux articles vers la caisse.
- `backend/Services/BarcodeService.cs` et `backend/Controllers/ProductVariantsController.cs`.
- `backend/Tresor.Api.csproj` : publication autonome Windows.
- `frontend/src/app/core/label-printer.service.ts` : etiquettes Code128 physiques.
- `frontend/src/app/core/data.service.ts` et les composants produits, caisse et connexion.
- `frontend/package.json`, `frontend/package-lock.json`, `frontend/tests/barcodes.cjs`
  et `frontend/tests/labels-ui.cjs` : dependances et verification independante.

Les sorties de compilation ne font pas partie de l'implementation. Des binaires,
journaux et bases etaient deja suivis et modifies dans Git avant cette intervention ;
ils n'ont pas ete supprimes ni desindexes. `.gitignore` empeche seulement de nouveaux
fichiers generes non suivis d'etre ajoutes accidentellement.
