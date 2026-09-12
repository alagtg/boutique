using System.Net.Http.Json;
using Microsoft.EntityFrameworkCore;
using Tresor.Api.Data;
using Tresor.Api.DTOs;
using Tresor.Api.Models;

namespace Tresor.Api.Services;

public sealed class CommerceProvisioningService(CommerceDbContext db, IHttpClientFactory clients, InstallationOptions installation)
{
    public async Task ImportAsync(CancellationToken ct = default)
    {
        if (await db.Users.AnyAsync(ct) || await db.Products.AnyAsync(ct) || await db.Customers.AnyAsync(ct) || await db.Sales.AnyAsync(ct))
            throw new InvalidOperationException("Provisioning requires an empty Commerce database. Existing data was not changed.");
        var data = await clients.CreateClient("BackOfficeApi").GetFromJsonAsync<CommerceReferenceDto>("api/sync/reference", ct)
            ?? throw new InvalidOperationException("Missing reference data.");
        await using var transaction = await db.Database.BeginTransactionAsync(ct);
        var roles = await InsertAsync(data.Roles, ct);
        foreach (var user in data.Users) user.RoleId = roles[user.RoleId];
        await InsertAsync(data.Users, ct);
        await InsertAsync(data.Settings, ct);
        var categories = await InsertAsync(data.Categories, ct);
        var brands = await InsertAsync(data.Brands, ct);
        foreach (var product in data.Products)
        {
            product.CategoryId = categories[product.CategoryId];
            product.BrandId = product.BrandId is int brandId ? brands[brandId] : null;
        }
        var products = await InsertAsync(data.Products, ct);
        foreach (var variant in data.Variants) variant.ProductId = products[variant.ProductId];
        var variants = await InsertAsync(data.Variants, ct);
        foreach (var image in data.Images)
        {
            image.ProductId = products[image.ProductId];
            image.ProductVariantId = image.ProductVariantId is int variantId ? variants[variantId] : null;
        }
        await InsertAsync(data.Images, ct);
        var customers = await InsertAsync(data.Customers, ct);
        foreach (var loyalty in data.Loyalty) loyalty.CustomerId = customers[loyalty.CustomerId];
        foreach (var voucher in data.Vouchers) voucher.CustomerId = customers[voucher.CustomerId];
        await InsertAsync(data.Loyalty, ct);
        await InsertAsync(data.Vouchers, ct);
        db.Registers.Add(new Register { RegisterName = installation.NodeId });
        await db.SaveChangesAsync(ct);
        await transaction.CommitAsync(ct);
    }

    private async Task<Dictionary<int, int>> InsertAsync<T>(List<T> entities, CancellationToken ct) where T : BaseEntity
    {
        var pairs = entities.Select(x => (SourceId: x.Id, Entity: x)).ToList();
        foreach (var pair in pairs) pair.Entity.Id = 0;
        db.Set<T>().AddRange(entities);
        await db.SaveChangesAsync(ct);
        var ids = pairs.ToDictionary(x => x.SourceId, x => x.Entity.Id);
        db.ChangeTracker.Clear();
        return ids;
    }
}
