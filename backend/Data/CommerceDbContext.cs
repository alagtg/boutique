using Microsoft.EntityFrameworkCore;

namespace Tresor.Api.Data;

public sealed class CommerceDbContext(DbContextOptions<CommerceDbContext> options) : AppDbContext(options);
