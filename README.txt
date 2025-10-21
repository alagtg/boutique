Trésor Boutique 
Backend (.NET 8 + SQL Server + JWT + Uploads)
Frontend (Angular 18 standalone: client + admin + stats)

Backend:
  dotnet tool install --global dotnet-ef
  cd tresor-backend
  dotnet restore
  dotnet ef migrations add Init
  dotnet ef database update
  dotnet run
Swagger: http://localhost:5000/swagger

Frontend:
  cd tresor-frontend
  npm install -g @angular/cli
  npm install
  npm start
Open: http://localhost:4200

Admin default: admin / admin123
DB name: basedonneetresor
