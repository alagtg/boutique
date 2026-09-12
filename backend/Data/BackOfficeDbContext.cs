using Microsoft.EntityFrameworkCore;

namespace Tresor.Api.Data;

public sealed class BackOfficeDbContext(DbContextOptions<BackOfficeDbContext> options) : AppDbContext(options);
