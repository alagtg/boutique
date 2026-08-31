# Trésor Boutique V2

Version V2 du starter Trésor Boutique :
- thème **blanc + gold**
- **POS desktop-first** pour utilisation avec **douchette code-barres**
- **ventes ligne par ligne**
- **vue facture mensuelle**
- **dépenses ligne par ligne** avec remarque
- **clients + fidélité + VIP + bons**
- **QR client** pour inscription rapide
- **réservations** avec rappel métier
- **paramètres boutique**

## Important
Cette version utilise `Database.EnsureCreated()` pour démarrer plus vite sans générer de migrations EF avant.

### Si tu avais déjà lancé une ancienne version
Supprime d'abord l'ancienne base **TresorBoutiqueDb** puis lance la nouvelle V2.

---

## Backend .NET
```bash
cd backend
dotnet restore
dotnet run
```

API :
- `http://localhost:5000`
- `https://localhost:7001`
- Swagger : `https://localhost:7001/swagger`

### Connexion SQL Server
Dans `backend/appsettings.json`, adapte `DefaultConnection`.

Exemple :
```json
"ConnectionStrings": {
  "DefaultConnection": "Server=DESKTOP-3TGJIKF\\SQL22;Database=TresorBoutiqueDb;User Id=sa;Password=ala;TrustServerCertificate=True;MultipleActiveResultSets=true"
}
```

---

## Frontend Angular
```bash
cd frontend
npm install
ng serve -o
```

Application :
- `http://localhost:4200`

---

## Comptes seed
- Admin : `admin / Admin@123`
- Employé : `employe / Employe@123`

---

## Routes principales
- `/login`
- `/admin/dashboard`
- `/admin/products`
- `/admin/customers`
- `/admin/sales`
- `/admin/expenses`
- `/admin/settings`
- `/employee/pos`
- `/employee/reservations`
- `/client/loyalty`
- `/client/wheel`
- `/qr-client`

---

## Support douchette code-barres
La douchette USB fonctionne comme un clavier :
1. ouvrir `/employee/pos`
2. cliquer sur **Focus scanner**
3. scanner l’article
4. la variante est retrouvée via le code-barres

---

## Limites actuelles
Cette V2 est une base avancée plus riche que la version initiale, mais elle n’est pas encore une solution de production finalisée à 100% pour tous les workflows boutique :
- pas de PDF facture réelle générée côté serveur
- pas de WhatsApp réel connecté
- la roue fonctionne côté interface mais sans moteur complet d’administration/quotas
- pas encore de tickets imprimables finalisés

La structure est prête pour continuer proprement.
