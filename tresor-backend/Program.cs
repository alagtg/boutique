using Microsoft.EntityFrameworkCore;
using System.Text.Json.Serialization;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.IdentityModel.Tokens;
using Microsoft.OpenApi.Models;
using System.Text;
using Tresor.Api.Data;
using Tresor.Api.Services;

var builder = WebApplication.CreateBuilder(args);

// ================================================
// 🔹 CORS (pour autoriser ton front Angular local)
// ================================================
var allowedOrigin = builder.Configuration["Cors:DevOrigin"] ?? "http://localhost:4200";
builder.Services.AddCors(opts =>
{
    opts.AddPolicy("dev", p => p
        .WithOrigins(allowedOrigin)
        .AllowAnyHeader()
        .AllowAnyMethod()
        .AllowCredentials());
});

// ================================================
// 🔹 Configuration MVC + JSON (évite les cycles)
// ================================================
builder.Services.AddControllers().AddJsonOptions(o =>
{
    o.JsonSerializerOptions.ReferenceHandler = ReferenceHandler.IgnoreCycles;
    o.JsonSerializerOptions.WriteIndented = true;
});

// ================================================
// 🔹 Swagger + Auth JWT intégré
// ================================================
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen(options =>
{
    options.SwaggerDoc("v1", new OpenApiInfo
    {
        Title = "Tresor Boutique API",
        Version = "v1",
        Description = "API officielle de la boutique Trésor à Djerba 💎"
    });

    // ✅ Ajout du bouton Authorize pour JWT
    options.AddSecurityDefinition("Bearer", new OpenApiSecurityScheme
    {
        In = ParameterLocation.Header,
        Description = "Collez le token JWT ici (sans 'Bearer ' devant)",
        Name = "Authorization",
        Type = SecuritySchemeType.Http,
        Scheme = "bearer",
        BearerFormat = "JWT"
    });

    options.AddSecurityRequirement(new OpenApiSecurityRequirement
    {
        {
            new OpenApiSecurityScheme
            {
                Reference = new OpenApiReference
                {
                    Type = ReferenceType.SecurityScheme,
                    Id = "Bearer"
                }
            },
            Array.Empty<string>()
        }
    });
});

// ================================================
// 🔹 Base de données SQL Server
// ================================================
builder.Services.AddDbContext<AppDbContext>(opt =>
    opt.UseSqlServer(builder.Configuration.GetConnectionString("Default")));

// ================================================
// 🔹 JWT Configuration
// ================================================
builder.Services.AddScoped<JwtService>();

var key = Encoding.UTF8.GetBytes(builder.Configuration["Jwt:Key"] ?? "dev-secret-key-change-it");
builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(o =>
    {
        o.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuer = true,
            ValidateAudience = true,
            ValidateLifetime = true,
            ValidateIssuerSigningKey = true,
            ValidIssuer = builder.Configuration["Jwt:Issuer"] ?? "Tresor.Api",
            ValidAudience = builder.Configuration["Jwt:Audience"] ?? "Tresor.Api.Client",
            IssuerSigningKey = new SymmetricSecurityKey(key)
        };
    });

// ================================================
// 🔹 Application
// ================================================
var app = builder.Build();

// ================================================
// 🔹 Middlewares
// ================================================
app.UseCors("dev");
app.UseSwagger();
app.UseSwaggerUI(c =>
{
    c.SwaggerEndpoint("/swagger/v1/swagger.json", "Tresor API v1");
    c.RoutePrefix = "swagger";
});

app.UseStaticFiles();
app.UseHttpsRedirection();
app.UseAuthentication();
app.UseAuthorization();

app.MapControllers();

// ================================================
// 🔹 Migration automatique + Seed admin
// ================================================
using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
    db.Database.Migrate();
}

using (var scope = app.Services.CreateScope())
{
    var context = scope.ServiceProvider.GetRequiredService<AppDbContext>();
    SeedData.Initialize(context);
}

// ================================================
// 🚀 Lancement de l'application
// ================================================
app.Run();
