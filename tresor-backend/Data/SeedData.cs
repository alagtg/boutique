using Tresor.Api.Models;
using Microsoft.EntityFrameworkCore;

namespace Tresor.Api.Data
{
    public static class SeedData
    {
        public static void Initialize(AppDbContext context)
        {
            // Crée la base si elle n'existe pas
            context.Database.EnsureCreated();

            // Vérifie si la table Users est vide
            if (!context.Users.Any())
            {
                // Création de l'admin par défaut
                var admin = new User
                {
                    Username = "admin",
                    PasswordHash = BCrypt.Net.BCrypt.HashPassword("admin123"),
                    Role = "Admin"
                };

                context.Users.Add(admin);
                context.SaveChanges();

                Console.WriteLine("✅ Admin par défaut créé : admin / admin123");
            }
            else
            {
                Console.WriteLine("ℹ️ Utilisateurs déjà présents dans la base, aucun seed ajouté.");
            }
        }
    }
}
