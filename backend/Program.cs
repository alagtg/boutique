using System.Text;
using System.Text.Json.Serialization;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using Tresor.Api.Data;
using Tresor.Api.Services;

var builder = WebApplication.CreateBuilder(args);
builder.Logging.ClearProviders();
builder.Logging.AddConsole();

var installation = builder.Configuration.GetSection("Installation").Get<InstallationOptions>() ?? new();
var sync = builder.Configuration.GetSection("BackOfficeApi").Get<BackOfficeApiOptions>() ?? new();
if (installation.Mode is not ("Standalone" or "Commerce" or "BackOffice"))
    throw new InvalidOperationException("Installation:Mode must be Standalone, Commerce or BackOffice.");
if (installation.IsCommerce && (string.IsNullOrWhiteSpace(installation.NodeId) || installation.NodeId.Length > 64))
    throw new InvalidOperationException("A stable Installation:NodeId (1-64 characters) is required.");
if (installation.Mode != "Standalone" && sync.SyncKey.Length < 32)
    throw new InvalidOperationException("Set BackOfficeApi:SyncKey to a secret of at least 32 characters.");
if (sync.TimeoutSeconds is < 1 or > 30 || sync.IntervalSeconds is < 1 or > 3600 || sync.BatchSize is < 1 or > 500)
    throw new InvalidOperationException("Invalid synchronization timeout, interval or batch size.");

builder.Services.AddSingleton(installation);
builder.Services.AddSingleton(sync);
builder.Services.AddSingleton<SalesSyncSignal>();
builder.Services.AddScoped<InstallationAccessFilter>();
builder.Services.AddControllers(options => options.Filters.AddService<InstallationAccessFilter>())
    .AddJsonOptions(options =>
    {
        options.JsonSerializerOptions.ReferenceHandler = ReferenceHandler.IgnoreCycles;
        options.JsonSerializerOptions.WriteIndented = true;
    });
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();

// Each process only registers its own connection. Commerce never resolves BackOfficeConnection.
if (installation.IsCommerce)
{
    builder.Services.AddDbContext<CommerceDbContext>(options =>
        ContextConfiguration.Configure(options, builder.Configuration, "CommerceConnection"));
    builder.Services.AddScoped<AppDbContext>(sp => sp.GetRequiredService<CommerceDbContext>());
    if (!Uri.TryCreate(sync.BaseUrl, UriKind.Absolute, out var uri) ||
        uri.Scheme is not ("https" or "http") || !string.IsNullOrEmpty(uri.UserInfo) ||
        !string.IsNullOrEmpty(uri.Query) || !string.IsNullOrEmpty(uri.Fragment) ||
        uri.AbsolutePath != "/" || uri.Scheme == "http" && !sync.AllowInsecureHttp)
        throw new InvalidOperationException("BackOfficeApi:BaseUrl must be an HTTPS origin. HTTP requires explicit AllowInsecureHttp.");
    builder.Services.AddHttpClient("BackOfficeApi", client =>
    {
        client.BaseAddress = uri;
        client.Timeout = TimeSpan.FromSeconds(sync.TimeoutSeconds);
        client.DefaultRequestHeaders.Add("X-Sync-Key", sync.SyncKey);
    }).ConfigurePrimaryHttpMessageHandler(() => new HttpClientHandler { AllowAutoRedirect = false });
    builder.Services.AddScoped<ISalesSyncService, SalesSyncService>();
    builder.Services.AddScoped<CommerceProvisioningService>();
    builder.Services.AddHostedService<SalesSyncBackgroundService>();
}
else if (installation.IsBackOffice)
{
    builder.Services.AddDbContext<BackOfficeDbContext>(options =>
        ContextConfiguration.Configure(options, builder.Configuration, "BackOfficeConnection"));
    builder.Services.AddScoped<AppDbContext>(sp => sp.GetRequiredService<BackOfficeDbContext>());
    builder.Services.AddScoped<SalesSyncReceiver>();
}
else
{
    builder.Services.AddDbContext<AppDbContext>(options =>
        ContextConfiguration.Configure(options, builder.Configuration, "DefaultConnection"));
}
builder.Services.AddScoped<JwtTokenService>();
builder.Services.AddScoped<BarcodeService>();
builder.Services.AddScoped<DbSeeder>();
builder.Services.AddScoped<CustomerSaleEffects>();
builder.Services.AddScoped<SaleSyncPayloadFactory>();

var jwtKey = builder.Configuration["Jwt:Key"];
if (string.IsNullOrWhiteSpace(jwtKey) || Encoding.UTF8.GetByteCount(jwtKey) < 32)
    throw new InvalidOperationException("Configure Jwt:Key using an environment variable or secret store (at least 32 bytes).");
var jwtIssuer = builder.Configuration["Jwt:Issuer"] ?? throw new InvalidOperationException("JWT issuer missing");
var jwtAudience = builder.Configuration["Jwt:Audience"] ?? throw new InvalidOperationException("JWT audience missing");
builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options => options.TokenValidationParameters = new TokenValidationParameters
    {
        ValidateIssuer = true, ValidateAudience = true, ValidateLifetime = true, ValidateIssuerSigningKey = true,
        ValidIssuer = jwtIssuer, ValidAudience = jwtAudience,
        IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtKey))
    })
    .AddScheme<AuthenticationSchemeOptions, SyncKeyAuthenticationHandler>(SyncKeyAuthenticationHandler.SchemeName, _ => { });
builder.Services.AddAuthorization();
builder.Services.AddCors(options => options.AddPolicy("frontend", policy =>
    policy.AllowAnyOrigin().AllowAnyMethod().AllowAnyHeader()));

var app = builder.Build();
await using (var scope = app.Services.CreateAsyncScope())
{
    var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
    if (args.Contains("--migrate-commerce"))
    {
        if (!installation.IsCommerce || !db.Database.IsSqlServer())
            throw new InvalidOperationException("This command requires Commerce mode with SQL Server.");
        await db.Database.MigrateAsync();
        app.Logger.LogInformation("Commerce database migrations applied.");
        return;
    }
    if (args.Contains("--adopt-existing-sqlserver"))
    {
        if (!installation.IsBackOffice) throw new InvalidOperationException("Adoption requires BackOffice mode.");
        await SqlServerTransition.AdoptAsync((BackOfficeDbContext)db, builder.Configuration, app.Logger);
        return;
    }
    if (args.Contains("--initialize-sqlite"))
    {
        if (!db.Database.IsSqlite()) throw new InvalidOperationException("This command is only for SQLite test/transition databases.");
        await SqliteTransition.InitializeAsync(db);
        return;
    }
    if (args.Contains("--provision-commerce"))
    {
        if (!installation.IsCommerce) throw new InvalidOperationException("Provisioning requires Commerce mode.");
        await scope.ServiceProvider.GetRequiredService<CommerceProvisioningService>().ImportAsync();
        app.Logger.LogInformation("Commerce reference data imported. Start the API normally.");
        return;
    }
    if (args.Contains("--seed-demo"))
    {
        if (installation.Mode != "Standalone") throw new InvalidOperationException("Demo seed is only allowed in Standalone mode.");
        await scope.ServiceProvider.GetRequiredService<DbSeeder>().SeedAsync();
        return;
    }
    // Startup is read-only: migrations and provisioning are explicit deployment steps.
    if (!await db.Database.CanConnectAsync())
        throw new InvalidOperationException("Database unavailable. Apply the documented database setup before starting.");
}
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
if (File.Exists(Path.Combine(app.Environment.WebRootPath ?? "", "index.html")))
    app.MapFallbackToFile("index.html");
app.Run();
