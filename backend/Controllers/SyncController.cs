using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Tresor.Api.Data;
using Tresor.Api.DTOs;
using Tresor.Api.Services;

namespace Tresor.Api.Controllers;

[ApiController]
[Route("api/sync")]
public sealed class SyncController(InstallationOptions installation, AppDbContext db,
    SalesSyncSignal signal, ILogger<SyncController> logger) : ControllerBase
{
    [HttpPost("sales")]
    [Authorize(AuthenticationSchemes = SyncKeyAuthenticationHandler.SchemeName)]
    [RequestSizeLimit(2_000_000)]
    public async Task<IActionResult> Receive(SaleSyncDto dto, CancellationToken ct)
    {
        if (!installation.IsBackOffice) return NotFound();
        try
        {
            return Ok(await HttpContext.RequestServices.GetRequiredService<SalesSyncReceiver>().ReceiveAsync(dto, ct));
        }
        catch (SyncMappingException ex)
        {
            logger.LogWarning("Sale {SyncId} mapping rejected: {Reason}", dto.SyncId, ex.Message);
            return Conflict(new { message = ex.Message });
        }
        catch (DbUpdateException)
        {
            logger.LogWarning("Sale {SyncId} could not be committed; sender may retry.", dto.SyncId);
            return StatusCode(503, new { message = "Synchronization transaction failed; retry later." });
        }
    }

    [HttpGet("health")]
    [Authorize(AuthenticationSchemes = SyncKeyAuthenticationHandler.SchemeName)]
    public async Task<IActionResult> Health(CancellationToken ct) => installation.IsBackOffice && await db.Database.CanConnectAsync(ct)
        ? Ok(new { ready = true }) : StatusCode(503);

    [HttpGet("reference")]
    [Authorize(AuthenticationSchemes = SyncKeyAuthenticationHandler.SchemeName)]
    public async Task<IActionResult> Reference(CancellationToken ct)
    {
        if (!installation.IsBackOffice) return NotFound();
        // AsNoTracking and separate reads intentionally exclude navigation graphs and all sales history.
        await using var transaction = await db.Database.BeginTransactionAsync(System.Data.IsolationLevel.Serializable, ct);
        var data = new CommerceReferenceDto
        {
            Roles = await db.Roles.AsNoTracking().ToListAsync(ct),
            Users = await db.Users.AsNoTracking().Where(x => x.IsActive).ToListAsync(ct),
            Settings = await db.StoreSettings.AsNoTracking().ToListAsync(ct),
            Categories = await db.Categories.AsNoTracking().ToListAsync(ct),
            Brands = await db.Brands.AsNoTracking().ToListAsync(ct),
            Products = await db.Products.AsNoTracking().ToListAsync(ct),
            Variants = await db.ProductVariants.AsNoTracking().ToListAsync(ct),
            Images = await db.ProductImages.AsNoTracking().ToListAsync(ct),
            Customers = await db.Customers.AsNoTracking().ToListAsync(ct),
            Loyalty = await db.LoyaltyAccounts.AsNoTracking().ToListAsync(ct),
            Vouchers = await db.Vouchers.AsNoTracking().ToListAsync(ct)
        };
        foreach (var variant in data.Variants) variant.PurchasePrice = 0;
        await transaction.CommitAsync(ct);
        return Ok(data);
    }

    [HttpGet("catalogue")]
    [Authorize(AuthenticationSchemes = SyncKeyAuthenticationHandler.SchemeName)]
    public async Task<IActionResult> Catalogue(CancellationToken ct)
    {
        if (!installation.IsBackOffice) return NotFound();
        await using var transaction = await db.Database.BeginTransactionAsync(System.Data.IsolationLevel.Serializable, ct);
        var data = new CommerceReferenceDto
        {
            Categories = await db.Categories.AsNoTracking().ToListAsync(ct),
            Products = await db.Products.AsNoTracking().ToListAsync(ct),
            Variants = await db.ProductVariants.AsNoTracking().ToListAsync(ct)
        };
        foreach (var variant in data.Variants) variant.PurchasePrice = 0;
        await transaction.CommitAsync(ct);
        return Ok(data);
    }

    [HttpGet("status")]
    [Authorize(Roles = "ADMIN")]
    public async Task<IActionResult> Status(CancellationToken ct)
    {
        var pending = installation.IsCommerce ? await db.Sales.CountAsync(x => !x.IsSynced, ct) : 0;
        var last = await db.Sales.Where(x => x.IsSynced).MaxAsync(x => x.SyncedAt, ct);
        bool? reachable = null;
        if (installation.IsCommerce)
        {
            try
            {
                using var response = await HttpContext.RequestServices.GetRequiredService<IHttpClientFactory>()
                    .CreateClient("BackOfficeApi").GetAsync("api/sync/health", ct);
                reachable = response.IsSuccessStatusCode;
            }
            catch (HttpRequestException) { reachable = false; }
            catch (OperationCanceledException) when (!ct.IsCancellationRequested) { reachable = false; }
        }
        return Ok(new { mode = installation.Mode, pending, lastSuccessfulSync = last, backOfficeReachable = reachable });
    }

    [HttpGet("pending")]
    [Authorize(Roles = "ADMIN")]
    public async Task<IActionResult> Pending(CancellationToken ct)
    {
        if (!installation.IsCommerce) return NotFound();
        return Ok(await db.Sales.Where(x => !x.IsSynced).OrderBy(x => x.Id).Take(200)
            .Select(x => new { x.SyncId, x.SaleNumber, x.SaleDate, x.SyncAttempts, x.LastSyncError }).ToListAsync(ct));
    }

    [HttpPost("retry")]
    [Authorize(Roles = "ADMIN")]
    public IActionResult Retry()
    {
        if (!installation.IsCommerce) return NotFound();
        signal.Notify();
        return Accepted(new { message = "Synchronization scheduled." });
    }
}
