using Microsoft.EntityFrameworkCore;
using Tresor.Api.Models;
using Tresor.Api.Services;

namespace Tresor.Api.Data;

public class DbSeeder
{
    private readonly AppDbContext _db;
    private readonly IConfiguration _configuration;
    private readonly BarcodeService _barcodeService;

    public DbSeeder(AppDbContext db, IConfiguration configuration, BarcodeService barcodeService)
    {
        _db = db;
        _configuration = configuration;
        _barcodeService = barcodeService;
    }

    public async Task SeedAsync()
    {
        if (!await _db.Roles.AnyAsync())
        {
            _db.Roles.AddRange(
                new Role { Name = "ADMIN", Description = "Administrateur principal" },
                new Role { Name = "EMPLOYE", Description = "Employé de boutique" }
            );
            await _db.SaveChangesAsync();
        }

        if (!await _db.Users.AnyAsync())
        {
            var adminRole = await _db.Roles.FirstAsync(r => r.Name == "ADMIN");
            var employeeRole = await _db.Roles.FirstAsync(r => r.Name == "EMPLOYE");

            _db.Users.AddRange(
                new User
                {
                    FullName = "Admin Trésor",
                    Username = "admin",
                    Email = "admin@tresor.tn",
                    PasswordHash = BCrypt.Net.BCrypt.HashPassword(_configuration["Seed:AdminPassword"]
                        ?? throw new InvalidOperationException("Configure Seed:AdminPassword before seeding.")),
                    RoleId = adminRole.Id,
                    IsActive = true
                },
                new User
                {
                    FullName = "Employé Boutique",
                    Username = "employe",
                    Email = "employe@tresor.tn",
                    PasswordHash = BCrypt.Net.BCrypt.HashPassword(_configuration["Seed:EmployeePassword"]
                        ?? throw new InvalidOperationException("Configure Seed:EmployeePassword before seeding.")),
                    RoleId = employeeRole.Id,
                    IsActive = true
                }
            );
            await _db.SaveChangesAsync();
        }

        if (!await _db.StoreSettings.AnyAsync())
        {
            _db.StoreSettings.Add(new StoreSetting
            {
                StoreName = _configuration["StoreDefaults:StoreName"] ?? "Trésor Boutique",
                PrimaryColor = _configuration["StoreDefaults:PrimaryColor"] ?? "#C9A13B",
                SecondaryColor = _configuration["StoreDefaults:SecondaryColor"] ?? "#9A7420",
                BackgroundColor = _configuration["StoreDefaults:BackgroundColor"] ?? "#FFFDF8",
                TextColor = _configuration["StoreDefaults:TextColor"] ?? "#1A1A1A",
                Phone = "50878068",
                WhatsAppNumber = "21650878068",
                Address = "Boutique Trésor",
                ReceiptFooterMessage = "Merci pour votre visite chez Trésor Boutique"
            });
            await _db.SaveChangesAsync();
        }

        if (!await _db.Categories.AnyAsync())
        {
            _db.Categories.AddRange(
                new Category { Name = "Robes" },
                new Category { Name = "Chaussures" },
                new Category { Name = "Sacs" },
                new Category { Name = "Accessoires" }
            );
            await _db.SaveChangesAsync();
        }

        if (!await _db.Brands.AnyAsync())
        {
            _db.Brands.Add(new Brand { Name = "Trésor Collection" });
            await _db.SaveChangesAsync();
        }

        if (!await _db.Registers.AnyAsync())
        {
            _db.Registers.Add(new Register { RegisterName = "Caisse principale", Location = "Boutique" });
            await _db.SaveChangesAsync();
        }

        if (!await _db.Products.AnyAsync())
        {
            var robeCategory = await _db.Categories.FirstAsync(c => c.Name == "Robes");
            var shoesCategory = await _db.Categories.FirstAsync(c => c.Name == "Chaussures");
            var brand = await _db.Brands.OrderBy(x => x.Id).FirstAsync();

            var p1 = new Product
            {
                ProductName = "Robe Satin Luxe",
                Reference = "ROB-001",
                Description = "Robe satin élégante",
                CategoryId = robeCategory.Id,
                BrandId = brand.Id
            };
            p1.Variants.Add(new ProductVariant
            {
                SKU = _barcodeService.GenerateSku(p1.ProductName),
                Barcode = _barcodeService.Generate(),
                Color = "Beige",
                Size = "M",
                PurchasePrice = 90,
                SalePrice = 189,
                CurrentStock = 12,
                MinStock = 3
            });

            var p2 = new Product
            {
                ProductName = "Escarpin Gold",
                Reference = "SHO-001",
                Description = "Chaussure soirée",
                CategoryId = shoesCategory.Id,
                BrandId = brand.Id
            };
            p2.Variants.Add(new ProductVariant
            {
                SKU = _barcodeService.GenerateSku(p2.ProductName),
                Barcode = _barcodeService.Generate(),
                Color = "Gold",
                Size = "38",
                PurchasePrice = 70,
                SalePrice = 149,
                CurrentStock = 6,
                MinStock = 2
            });

            _db.Products.AddRange(p1, p2);
            await _db.SaveChangesAsync();
        }

        if (!await _db.Customers.AnyAsync())
        {
            var customer = new Customer
            {
                FirstName = "Ines",
                LastName = "Ben Ali",
                Phone = "22111222",
                City = "Tunis",
                QrCodeToken = Guid.NewGuid().ToString("N"),
                VipStatus = true,
                TotalSpentLifetime = 1450,
                TotalSpentCurrentMonth = 350,
                CurrentCreditAmount = 0
            };

            _db.Customers.Add(customer);
            await _db.SaveChangesAsync();

            _db.LoyaltyAccounts.Add(new LoyaltyAccount
            {
                CustomerId = customer.Id,
                PointsBalance = 120,
                TierLevel = "VIP"
            });

            _db.Vouchers.Add(new Voucher
            {
                CustomerId = customer.Id,
                Code = "BON20-TRESOR",
                VoucherType = "AMOUNT",
                Value = 20,
                MinPurchaseAmount = 150,
                Status = "ACTIVE"
            });

            await _db.SaveChangesAsync();
        }

        if (!await _db.ExpenseCategories.AnyAsync())
        {
            _db.ExpenseCategories.AddRange(
                new ExpenseCategory { Name = "Loyer" },
                new ExpenseCategory { Name = "Salaires" },
                new ExpenseCategory { Name = "Achat stock" },
                new ExpenseCategory { Name = "Publicité" },
                new ExpenseCategory { Name = "Transport" },
                new ExpenseCategory { Name = "Internet" }
            );
            await _db.SaveChangesAsync();
        }

        if (!await _db.Expenses.AnyAsync())
        {
            var loyer = await _db.ExpenseCategories.FirstAsync(x => x.Name == "Loyer");
            var stock = await _db.ExpenseCategories.FirstAsync(x => x.Name == "Achat stock");

            _db.Expenses.AddRange(
                new Expense
                {
                    ExpenseCategoryId = loyer.Id,
                    ExpenseDate = DateTime.UtcNow.Date.AddDays(-5),
                    Amount = 1800,
                    PaymentMethod = "TRANSFER",
                    SupplierName = "Propriétaire",
                    Description = "Loyer mensuel boutique",
                    Remark = "Payé début du mois"
                },
                new Expense
                {
                    ExpenseCategoryId = stock.Id,
                    ExpenseDate = DateTime.UtcNow.Date.AddDays(-2),
                    Amount = 920,
                    PaymentMethod = "CASH",
                    SupplierName = "Grossiste mode",
                    Description = "Réassort robes et chaussures",
                    Remark = "Facture fournisseur reçue"
                }
            );
            await _db.SaveChangesAsync();
        }

        await EnsureDemoShowroomAsync();
    }

    private async Task EnsureDemoShowroomAsync()
    {
        var settings = await _db.StoreSettings.OrderBy(x => x.Id).FirstAsync();
        settings.StoreName = "Tresor Boutique";
        settings.PrimaryColor = "#C9A13B";
        settings.SecondaryColor = "#8B5E1B";
        settings.BackgroundColor = "#FFFDF8";
        settings.TextColor = "#1A1A1A";
        settings.ReceiptFooterMessage = "Merci pour votre visite chez Tresor Boutique";

        await EnsureCategoriesAsync("Robes", "Chaussures", "Sacs", "Accessoires", "Parfums", "Bijoux", "Ensembles", "Hijab");
        await EnsureBrandAsync("Tresor Collection");
        await EnsureBrandAsync("Maison Doree");
        await EnsureBrandAsync("Boutique Selection");

        await EnsureProductsAsync();
        await EnsureCustomersAsync();
        await EnsureCashSessionAsync();
        await EnsureSalesAsync();
        await EnsureReservationsAsync();
        await EnsureExpensesAsync();

        await _db.SaveChangesAsync();
    }

    private async Task EnsureCategoriesAsync(params string[] names)
    {
        foreach (var name in names)
        {
            if (!await _db.Categories.AnyAsync(x => x.Name == name))
                _db.Categories.Add(new Category { Name = name });
        }

        await _db.SaveChangesAsync();
    }

    private async Task EnsureBrandAsync(string name)
    {
        if (!await _db.Brands.AnyAsync(x => x.Name == name))
        {
            _db.Brands.Add(new Brand { Name = name });
            await _db.SaveChangesAsync();
        }
    }

    private async Task EnsureProductsAsync()
    {
        var testProduct = await _db.Products.FirstOrDefaultAsync(x => x.ProductName == "Test Photo Upload");
        if (testProduct is not null)
        {
            testProduct.ProductName = "Robe plisse satin photo";
            testProduct.Reference = "ROB-PHOTO";
            testProduct.Description = "Article demo avec photo importee";
            await _db.SaveChangesAsync();
        }

        var brand = await _db.Brands.FirstAsync(x => x.Name == "Tresor Collection");
        var maison = await _db.Brands.FirstAsync(x => x.Name == "Maison Doree");
        var selection = await _db.Brands.FirstAsync(x => x.Name == "Boutique Selection");

        await AddProductIfMissingAsync("ROB-002", "Robe cache-coeur ivoire", "Robe fluide elegante pour journee et soiree", "Robes", brand.Id, "Ivoire", "S", 82, 169, 9, 3);
        await AddProductIfMissingAsync("ROB-003", "Robe blazer noir", "Coupe structuree moderne avec boutons dores", "Robes", maison.Id, "Noir", "M", 118, 249, 5, 2);
        await AddProductIfMissingAsync("ENS-001", "Ensemble tailleur creme", "Veste et pantalon chic pour bureau ou evenement", "Ensembles", maison.Id, "Creme", "M", 140, 299, 4, 2);
        await AddProductIfMissingAsync("SAC-001", "Sac matelasse caramel", "Sac compact avec chaine metal dore", "Sacs", selection.Id, "Caramel", "TU", 65, 139, 11, 3);
        await AddProductIfMissingAsync("SAC-002", "Pochette soiree nacree", "Pochette brillante avec fermeture bijou", "Sacs", selection.Id, "Nacre", "TU", 54, 119, 2, 3);
        await AddProductIfMissingAsync("BIJ-001", "Boucles cercle dore", "Boucles legeres finition doree", "Bijoux", brand.Id, "Or", "TU", 18, 49, 24, 5);
        await AddProductIfMissingAsync("ACC-001", "Ceinture fine cuir", "Ceinture ajustable boucle doree", "Accessoires", selection.Id, "Camel", "TU", 25, 69, 7, 3);
        await AddProductIfMissingAsync("PAR-001", "Brume Ambre Boutique", "Brume parfumee ambree, format sac", "Parfums", maison.Id, "Ambre", "100ml", 32, 89, 13, 4);
        await AddProductIfMissingAsync("HIJ-001", "Hijab mousseline premium", "Mousseline douce et legere", "Hijab", selection.Id, "Sauge", "TU", 15, 39, 1, 4);
        await AddProductIfMissingAsync("SHO-002", "Mule satin champagne", "Mule confortable avec talon moyen", "Chaussures", brand.Id, "Champagne", "39", 68, 149, 6, 2);
    }

    private async Task AddProductIfMissingAsync(
        string reference,
        string name,
        string description,
        string categoryName,
        int brandId,
        string color,
        string size,
        decimal purchasePrice,
        decimal salePrice,
        int stock,
        int minStock)
    {
        if (await _db.Products.AnyAsync(x => x.Reference == reference))
            return;

        var category = await _db.Categories.FirstAsync(x => x.Name == categoryName);
        var product = new Product
        {
            ProductName = name,
            Reference = reference,
            Description = description,
            CategoryId = category.Id,
            BrandId = brandId
        };

        product.Variants.Add(new ProductVariant
        {
            SKU = reference,
            Barcode = $"TB-{reference.Replace("-", "")}",
            Color = color,
            Size = size,
            PurchasePrice = purchasePrice,
            SalePrice = salePrice,
            CurrentStock = stock,
            MinStock = minStock
        });

        _db.Products.Add(product);
        await _db.SaveChangesAsync();
    }

    private async Task EnsureCustomersAsync()
    {
        await AddCustomerIfMissingAsync("22111222", "Ines", "Ben Ali", "Tunis", true, 1450, 350, 0, 120, "VIP");
        await AddCustomerIfMissingAsync("55222444", "Meriem", "Trabelsi", "La Marsa", true, 2380, 620, 0, 238, "VIP");
        await AddCustomerIfMissingAsync("98777111", "Sarra", "Mansour", "Sousse", false, 410, 210, 0, 41, "STANDARD");
        await AddCustomerIfMissingAsync("50444555", "Nour", "Kacem", "Ariana", false, 760, 380, 420, 76, "STANDARD");
        await AddCustomerIfMissingAsync("29333444", "Rania", "Saidi", "Nabeul", true, 1260, 540, 0, 126, "VIP");
    }

    private async Task AddCustomerIfMissingAsync(string phone, string firstName, string lastName, string city, bool vip, decimal lifetime, decimal currentMonth, decimal credit, int points, string tier)
    {
        if (await _db.Customers.AnyAsync(x => x.Phone == phone))
            return;

        var customer = new Customer
        {
            FirstName = firstName,
            LastName = lastName,
            Phone = phone,
            City = city,
            QrCodeToken = Guid.NewGuid().ToString("N"),
            VipStatus = vip,
            TotalSpentLifetime = lifetime,
            TotalSpentCurrentMonth = currentMonth,
            CurrentCreditAmount = credit
        };

        _db.Customers.Add(customer);
        await _db.SaveChangesAsync();

        _db.LoyaltyAccounts.Add(new LoyaltyAccount
        {
            CustomerId = customer.Id,
            PointsBalance = points,
            TierLevel = tier
        });

        if (vip)
        {
            _db.Vouchers.Add(new Voucher
            {
                CustomerId = customer.Id,
                Code = $"VIP-{customer.Id}-2026",
                VoucherType = "AMOUNT",
                Value = 30,
                MinPurchaseAmount = 180,
                Status = "ACTIVE"
            });
        }
    }

    private async Task EnsureCashSessionAsync()
    {
        if (await _db.CashSessions.AnyAsync())
            return;

        var register = await _db.Registers.OrderBy(x => x.Id).FirstAsync();
        var admin = await _db.Users.FirstAsync(x => x.Username == "admin");

        _db.CashSessions.Add(new CashSession
        {
            RegisterId = register.Id,
            OpenedByUserId = admin.Id,
            OpeningAmount = 250,
            OpenedAt = DateTime.UtcNow.Date.AddHours(9),
            Status = "OPEN"
        });

        await _db.SaveChangesAsync();
    }

    private async Task EnsureSalesAsync()
    {
        if (await _db.Sales.AnyAsync(x => x.SaleNumber.StartsWith("DEMO-")))
            return;

        var admin = await _db.Users.FirstAsync(x => x.Username == "admin");
        var cashSession = await _db.CashSessions.OrderBy(x => x.Id).FirstOrDefaultAsync();
        var customers = await _db.Customers.OrderBy(x => x.Id).Take(5).ToListAsync();
        var variants = (await _db.ProductVariants.Include(x => x.Product).ToListAsync())
            .OrderByDescending(x => x.SalePrice)
            .Take(8)
            .ToList();

        if (customers.Count == 0 || variants.Count < 3)
            return;

        var dates = new[] { DateTime.UtcNow.Date.AddHours(10), DateTime.UtcNow.Date.AddHours(14), DateTime.UtcNow.Date.AddDays(-1).AddHours(16), DateTime.UtcNow.Date.AddDays(-4).AddHours(12), DateTime.UtcNow.Date.AddDays(-9).AddHours(17) };

        for (var i = 0; i < dates.Length; i++)
        {
            var first = variants[i % variants.Count];
            var second = variants[(i + 2) % variants.Count];
            var subtotal = first.SalePrice + second.SalePrice;
            var paid = i == 3 ? subtotal - 80 : subtotal;

            var sale = new Sale
            {
                SaleNumber = $"DEMO-{DateTime.UtcNow:yyyyMM}-{i + 1:000}",
                UserId = admin.Id,
                CustomerId = customers[i % customers.Count].Id,
                CashSessionId = cashSession?.Id,
                SaleDate = dates[i],
                SubtotalAmount = subtotal,
                DiscountAmount = 0,
                TotalAmount = subtotal,
                PaidAmount = paid,
                RemainingAmount = subtotal - paid,
                SaleStatus = "COMPLETED"
            };

            sale.Lines.Add(new SaleLine { ProductVariantId = first.Id, Quantity = 1, UnitPrice = first.SalePrice, LineTotal = first.SalePrice });
            sale.Lines.Add(new SaleLine { ProductVariantId = second.Id, Quantity = 1, UnitPrice = second.SalePrice, LineTotal = second.SalePrice });
            sale.Payments.Add(new SalePayment { PaymentMethod = i % 2 == 0 ? "CASH" : "CARD", Amount = paid });
            _db.Sales.Add(sale);
        }

        await _db.SaveChangesAsync();
    }

    private async Task EnsureReservationsAsync()
    {
        if (await _db.Reservations.AnyAsync(x => x.ReservationNumber.StartsWith("RES-DEMO-")))
            return;

        var admin = await _db.Users.FirstAsync(x => x.Username == "admin");
        var customer = await _db.Customers.OrderBy(x => x.Id).FirstAsync();
        var variant = (await _db.ProductVariants.ToListAsync()).OrderByDescending(x => x.SalePrice).First();

        _db.Reservations.Add(new Reservation
        {
            ReservationNumber = $"RES-DEMO-{DateTime.UtcNow:yyyyMM}-001",
            CustomerId = customer.Id,
            CreatedByUserId = admin.Id,
            ReservationDate = DateTime.UtcNow.Date.AddDays(-3),
            DueDate = DateTime.UtcNow.Date.AddDays(-1),
            DepositAmount = 80,
            TotalAmount = variant.SalePrice,
            RemainingAmount = variant.SalePrice - 80,
            Status = "RESERVED",
            Items =
            {
                new ReservationItem
                {
                    ProductVariantId = variant.Id,
                    Quantity = 1,
                    UnitPrice = variant.SalePrice,
                    LineTotal = variant.SalePrice
                }
            }
        });

        await _db.SaveChangesAsync();
    }

    private async Task EnsureExpensesAsync()
    {
        var testExpenses = await _db.Expenses
            .Where(x => x.Description == "Photo justificatif test")
            .ToListAsync();
        if (testExpenses.Count > 0)
        {
            _db.Expenses.RemoveRange(testExpenses);
            await _db.SaveChangesAsync();
        }

        await EnsureExpenseCategoryAsync("Packaging");
        await EnsureExpenseCategoryAsync("Publicite");
        await EnsureExpenseCategoryAsync("Shooting photo");
        await EnsureExpenseCategoryAsync("Maintenance");

        if (await _db.Expenses.AnyAsync(x => x.Description == "Packaging sacs cadeau et rubans"))
            return;

        var packaging = await _db.ExpenseCategories.FirstAsync(x => x.Name == "Packaging");
        var ads = await _db.ExpenseCategories.FirstAsync(x => x.Name == "Publicite");
        var photo = await _db.ExpenseCategories.FirstAsync(x => x.Name == "Shooting photo");
        var maintenance = await _db.ExpenseCategories.FirstAsync(x => x.Name == "Maintenance");

        _db.Expenses.AddRange(
            new Expense { ExpenseCategoryId = packaging.Id, ExpenseDate = DateTime.UtcNow.Date.AddDays(-1), Amount = 165, PaymentMethod = "CASH", SupplierName = "Print & Gift", Description = "Packaging sacs cadeau et rubans", Remark = "Nouvelle collection" },
            new Expense { ExpenseCategoryId = ads.Id, ExpenseDate = DateTime.UtcNow.Date.AddDays(-3), Amount = 260, PaymentMethod = "CARD", SupplierName = "Meta Ads", Description = "Campagne Instagram robes et sacs", Remark = "Audience Tunis / La Marsa" },
            new Expense { ExpenseCategoryId = photo.Id, ExpenseDate = DateTime.UtcNow.Date.AddDays(-7), Amount = 430, PaymentMethod = "TRANSFER", SupplierName = "Studio Lumiere", Description = "Shooting nouvelle collection", Remark = "Photos produits catalogue" },
            new Expense { ExpenseCategoryId = maintenance.Id, ExpenseDate = DateTime.UtcNow.Date.AddDays(-10), Amount = 95, PaymentMethod = "CASH", SupplierName = "Technicien POS", Description = "Maintenance douchette code-barres", Remark = "Test caisse OK" }
        );
    }

    private async Task EnsureExpenseCategoryAsync(string name)
    {
        if (!await _db.ExpenseCategories.AnyAsync(x => x.Name == name))
        {
            _db.ExpenseCategories.Add(new ExpenseCategory { Name = name });
            await _db.SaveChangesAsync();
        }
    }
}
