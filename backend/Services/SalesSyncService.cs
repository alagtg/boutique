using System.Net.Http.Json;
using System.Text;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Tresor.Api.Data;
using Tresor.Api.DTOs;

namespace Tresor.Api.Services;

public interface ISalesSyncService
{
    Task<bool> SyncSaleAsync(Guid syncId, CancellationToken ct = default);
    Task SyncPendingSalesAsync(CancellationToken ct = default);
}

public sealed class SalesSyncService(CommerceDbContext db, IHttpClientFactory clients,
    BackOfficeApiOptions options, ILogger<SalesSyncService> logger) : ISalesSyncService
{
    public async Task SyncPendingSalesAsync(CancellationToken ct = default)
    {
        var ids = await db.Sales.AsNoTracking().Where(x => !x.IsSynced)
            .OrderBy(x => x.SyncAttempts).ThenBy(x => x.Id).Select(x => x.SyncId)
            .Take(options.BatchSize).ToListAsync(ct);
        logger.LogInformation("Sales awaiting synchronization in this batch: {Count}", ids.Count);
        foreach (var id in ids) await SyncSaleAsync(id, ct);
    }

    public async Task<bool> SyncSaleAsync(Guid syncId, CancellationToken ct = default)
    {
        var sale = await db.Sales.SingleAsync(x => x.SyncId == syncId, ct);
        if (sale.IsSynced) return true;
        sale.SyncAttempts++;
        // Persist the attempt before sending, including attempts interrupted by a process crash.
        await db.SaveChangesAsync(ct);
        try
        {
            if (sale.SyncPayload == null) throw new InvalidOperationException("Missing immutable sale payload.");
            using var content = new StringContent(sale.SyncPayload, Encoding.UTF8, "application/json");
            using var response = await clients.CreateClient("BackOfficeApi").PostAsync("api/sync/sales", content, ct);
            if (!response.IsSuccessStatusCode)
            {
                sale.LastSyncError = $"BackOffice HTTP {(int)response.StatusCode}. Check receiver logs and reference mappings.";
            }
            else
            {
                var receipt = await response.Content.ReadFromJsonAsync<SaleSyncReceipt>(cancellationToken: ct);
                if (receipt?.SyncId != sale.SyncId) throw new InvalidOperationException("Invalid acknowledgement.");
                sale.IsSynced = true;
                sale.SyncedAt = DateTime.UtcNow;
                sale.LastSyncError = null;
                logger.LogInformation("Sale {SyncId} synchronized; already present: {AlreadyExists}", syncId, receipt.AlreadyExists);
            }
        }
        catch (OperationCanceledException) when (ct.IsCancellationRequested) { throw; }
        catch (Exception ex) when (ex is HttpRequestException or TaskCanceledException or JsonException or InvalidOperationException)
        {
            // Do not persist response bodies, URLs with credentials, or exception messages containing secrets.
            sale.LastSyncError = $"Synchronization failed ({ex.GetType().Name}); local sale retained.";
        }
        if (!sale.IsSynced) logger.LogWarning("Sale {SyncId}: {Error}", syncId, sale.LastSyncError);
        await db.SaveChangesAsync(ct);
        db.ChangeTracker.Clear();
        return sale.IsSynced;
    }
}
