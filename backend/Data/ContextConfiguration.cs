using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Design;

namespace Tresor.Api.Data;

public static class ContextConfiguration
{
    public static void Configure(DbContextOptionsBuilder options, IConfiguration config, string connectionName)
    {
        var connection = config.GetConnectionString(connectionName)
            ?? throw new InvalidOperationException($"ConnectionStrings:{connectionName} is required.");
        switch (config["Database:Provider"] ?? "Sqlite")
        {
            case "SqlServer": options.UseSqlServer(connection); break;
            case "Sqlite": options.UseSqlite(connection); break;
            default: throw new InvalidOperationException("Database:Provider must be Sqlite or SqlServer.");
        }
    }

    public static IConfiguration DesignConfiguration(string[] args) => new ConfigurationBuilder()
        .SetBasePath(Directory.GetCurrentDirectory()).AddJsonFile("appsettings.json", optional: true)
        .AddEnvironmentVariables().AddCommandLine(args).Build();
}

public sealed class CommerceContextFactory : IDesignTimeDbContextFactory<CommerceDbContext>
{
    public CommerceDbContext CreateDbContext(string[] args)
    {
        var options = new DbContextOptionsBuilder<CommerceDbContext>();
        ContextConfiguration.Configure(options, ContextConfiguration.DesignConfiguration(args), "CommerceConnection");
        return new CommerceDbContext(options.Options);
    }
}

public sealed class BackOfficeContextFactory : IDesignTimeDbContextFactory<BackOfficeDbContext>
{
    public BackOfficeDbContext CreateDbContext(string[] args)
    {
        var options = new DbContextOptionsBuilder<BackOfficeDbContext>();
        ContextConfiguration.Configure(options, ContextConfiguration.DesignConfiguration(args), "BackOfficeConnection");
        return new BackOfficeDbContext(options.Options);
    }
}
