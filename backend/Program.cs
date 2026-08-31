using System.Text;
using System.Text.Json.Serialization;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using Tresor.Api.Data;
using Tresor.Api.Services;

var builder = WebApplication.CreateBuilder(args);

builder.Logging.ClearProviders();
builder.Logging.AddConsole();

builder.Services.AddControllers()
    .AddJsonOptions(options =>
    {
        options.JsonSerializerOptions.ReferenceHandler = ReferenceHandler.IgnoreCycles;
        options.JsonSerializerOptions.WriteIndented = true;
    });

builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();

builder.Services.AddDbContext<AppDbContext>(options =>
    options.UseSqlite(builder.Configuration.GetConnectionString("DefaultConnection")));

builder.Services.AddScoped<JwtTokenService>();
builder.Services.AddScoped<BarcodeService>();
builder.Services.AddScoped<DbSeeder>();

var jwtKey = builder.Configuration["Jwt:Key"] ?? throw new InvalidOperationException("JWT key missing");
var jwtIssuer = builder.Configuration["Jwt:Issuer"] ?? throw new InvalidOperationException("JWT issuer missing");
var jwtAudience = builder.Configuration["Jwt:Audience"] ?? throw new InvalidOperationException("JWT audience missing");

builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options =>
    {
        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuer = true,
            ValidateAudience = true,
            ValidateLifetime = true,
            ValidateIssuerSigningKey = true,
            ValidIssuer = jwtIssuer,
            ValidAudience = jwtAudience,
            IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtKey))
        };
    });

builder.Services.AddAuthorization();
builder.Services.AddCors(options =>
{
    options.AddPolicy("frontend", policy =>
        policy.AllowAnyOrigin().AllowAnyMethod().AllowAnyHeader());
});

var app = builder.Build();

if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

app.UseCors("frontend");
app.UseStaticFiles();
app.UseAuthentication();
app.UseAuthorization();
app.MapControllers();

var spaIndexPath = Path.Combine(app.Environment.WebRootPath ?? string.Empty, "index.html");
if (File.Exists(spaIndexPath))
{
    app.MapFallbackToFile("index.html");
}

using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();

    // V2 dev bootstrap:
    // This project uses EnsureCreated so it can run without generating EF migrations first.
    // If you already created an old/incomplete TresorBoutiqueDb, delete it once before running V2.
    await db.Database.EnsureCreatedAsync();
    await db.Database.ExecuteSqlRawAsync("""
        CREATE TABLE IF NOT EXISTS StockPurchases (
            Id INTEGER NOT NULL CONSTRAINT PK_StockPurchases PRIMARY KEY AUTOINCREMENT,
            ProductVariantId INTEGER NOT NULL,
            Quantity INTEGER NOT NULL,
            UnitPurchasePrice decimal(18,2) NOT NULL,
            PurchaseDate TEXT NOT NULL,
            Notes TEXT NULL,
            CreatedAt TEXT NOT NULL,
            UpdatedAt TEXT NULL,
            CONSTRAINT FK_StockPurchases_ProductVariants_ProductVariantId
                FOREIGN KEY (ProductVariantId) REFERENCES ProductVariants (Id) ON DELETE CASCADE
        );
        CREATE INDEX IF NOT EXISTS IX_StockPurchases_ProductVariantId ON StockPurchases (ProductVariantId);
        CREATE TABLE IF NOT EXISTS AppMetadata (
            Key TEXT NOT NULL CONSTRAINT PK_AppMetadata PRIMARY KEY,
            Value TEXT NOT NULL
        );
        UPDATE ProductVariants
        SET PurchasePrice = 0
        WHERE NOT EXISTS (SELECT 1 FROM AppMetadata WHERE Key = 'LegacyStockCostReset20260711');
        INSERT OR IGNORE INTO AppMetadata (Key, Value)
        VALUES ('LegacyStockCostReset20260711', 'Existing stock was already paid; initial cost reset to zero.');
        """);
    try
    {
        await db.Database.ExecuteSqlRawAsync("ALTER TABLE Expenses ADD COLUMN ReceiptImagePath TEXT");
    }
    catch
    {
        // Existing local SQLite databases may already have this optional column.
    }
    try
    {
        await db.Database.ExecuteSqlRawAsync("ALTER TABLE Sales ADD COLUMN DiscountReason TEXT");
    }
    catch
    {
        // Existing local SQLite databases may already have this optional column.
    }
    try
    {
        await db.Database.ExecuteSqlRawAsync("ALTER TABLE StoreSettings ADD COLUMN WheelPrizes TEXT NOT NULL DEFAULT 'Cadeau boutique|Reduction 10%|Bon achat 20 DT|Surprise prochaine visite'");
    }
    catch
    {
        // Existing local SQLite databases may already have this optional column.
    }
    try
    {
        await db.Database.ExecuteSqlRawAsync("ALTER TABLE StoreSettings ADD COLUMN MonthlyGiftPrize TEXT NOT NULL DEFAULT 'Cadeau mensuel Tresor Boutique'");
    }
    catch
    {
        // Existing local SQLite databases may already have this optional column.
    }
    try
    {
        await db.Database.ExecuteSqlRawAsync("ALTER TABLE StoreSettings ADD COLUMN MonthlyGiftReminderMessage TEXT NOT NULL DEFAULT 'Rappel fin de mois: faites le tirage cadeau parmi tous les clients qui ont achete ce mois.'");
    }
    catch
    {
        // Existing local SQLite databases may already have this optional column.
    }

    var seeder = scope.ServiceProvider.GetRequiredService<DbSeeder>();
    await seeder.SeedAsync();

    // Any variant without a stock-purchase line belongs to the already-paid legacy stock.
    await db.Database.ExecuteSqlRawAsync("""
        UPDATE ProductVariants
        SET PurchasePrice = 0
        WHERE NOT EXISTS (
            SELECT 1 FROM StockPurchases sp WHERE sp.ProductVariantId = ProductVariants.Id
        );
        """);
}

app.Run();
