using System.Net.Http.Json;
using Microsoft.EntityFrameworkCore;
using Tresor.Api.Data;
using Tresor.Api.DTOs;
using Tresor.Api.Models;

namespace Tresor.Api.Services;

public sealed class CatalogueSyncService(CommerceDbContext db, IHttpClientFactory clients)
{
    public async Task RefreshAsync(CancellationToken ct)
    {
        var data = await clients.CreateClient("BackOfficeReference")
            .GetFromJsonAsync<CommerceReferenceDto>("api/sync/catalogue", ct)
            ?? throw new InvalidOperationException("Missing catalogue.");
        await using var transaction = await db.Database.BeginTransactionAsync(ct);
        var categories = await db.Categories.ToListAsync(ct);
        var products = await db.Products.Include(x => x.Variants).ToListAsync(ct);
        var variants = products.SelectMany(x => x.Variants).ToDictionary(x => x.Barcode);
        foreach (var source in data.Products)
        {
            var sourceVariants = data.Variants.Where(x => x.ProductId == source.Id).ToList();
            if (sourceVariants.Count == 0) continue;
            var localProducts = sourceVariants.Where(x => variants.ContainsKey(x.Barcode))
                .Select(x => variants[x.Barcode].Product).Distinct().ToList();
            if (localProducts.Count > 1) throw new InvalidOperationException("Ambiguous barcode catalogue mapping.");
            var product = localProducts.SingleOrDefault();
            if (product == null)
            {
                product = new Product();
                db.Products.Add(product);
                products.Add(product);
            }
            var sourceCategory = data.Categories.Single(x => x.Id == source.CategoryId);
            var category = categories.FirstOrDefault(x => x.Name == sourceCategory.Name);
            if (category == null)
            {
                category = new Category { Name = sourceCategory.Name };
                categories.Add(category);
            }
            product.Category = category;
            product.ProductName = source.ProductName;
            product.Reference = source.Reference;
            product.Description = source.Description;
            product.IsActive = source.IsActive;
            foreach (var sourceVariant in sourceVariants)
            {
                if (!variants.TryGetValue(sourceVariant.Barcode, out var variant))
                {
                    variant = new ProductVariant { Product = product, Barcode = sourceVariant.Barcode,
                        CurrentStock = sourceVariant.CurrentStock };
                    product.Variants.Add(variant);
                    variants.Add(variant.Barcode, variant);
                }
                variant.SKU = sourceVariant.SKU;
                variant.Color = sourceVariant.Color;
                variant.Size = sourceVariant.Size;
                variant.SalePrice = sourceVariant.SalePrice;
                variant.IsActive = sourceVariant.IsActive;
                variant.IsReservable = sourceVariant.IsReservable;
                variant.MinStock = sourceVariant.MinStock;
                // Existing local stock includes offline sales and must never be overwritten by a remote snapshot.
            }
        }
        await db.SaveChangesAsync(ct);
        await transaction.CommitAsync(ct);
        db.ChangeTracker.Clear();
    }
}
