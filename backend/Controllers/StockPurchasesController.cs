using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Tresor.Api.Data;
using Tresor.Api.DTOs;
using Tresor.Api.Models;

namespace Tresor.Api.Controllers;

[ApiController]
[Route("api/stock-purchases")]
[Authorize(Roles = "ADMIN")]
public class StockPurchasesController : ControllerBase
{
    private readonly AppDbContext _db;

    public StockPurchasesController(AppDbContext db)
    {
        _db = db;
    }

    [HttpGet]
    public async Task<IActionResult> GetAll([FromQuery] int? year = null, [FromQuery] int? month = null)
    {
        var query = _db.StockPurchases
            .Include(x => x.ProductVariant).ThenInclude(x => x.Product).ThenInclude(x => x.Images)
            .AsQueryable();

        if (year.HasValue)
            query = query.Where(x => x.PurchaseDate.Year == year.Value);
        if (month.HasValue)
            query = query.Where(x => x.PurchaseDate.Month == month.Value);

        var items = await query
            .OrderByDescending(x => x.PurchaseDate)
            .ThenByDescending(x => x.Id)
            .Select(x => new
            {
                x.Id,
                x.ProductVariantId,
                productName = x.ProductVariant.Product.ProductName,
                reference = x.ProductVariant.Product.Reference,
                barcode = x.ProductVariant.Barcode,
                imageUrl = x.ProductVariant.Product.Images
                    .OrderByDescending(i => i.IsPrimary)
                    .ThenBy(i => i.Id)
                    .Select(i => i.ImagePath)
                    .FirstOrDefault(),
                x.Quantity,
                x.UnitPurchasePrice,
                totalAmount = x.UnitPurchasePrice * x.Quantity,
                x.PurchaseDate,
                x.Notes
            })
            .ToListAsync();

        var inventoryBase = await _db.ProductVariants
            .Where(x => x.IsActive && x.Product.IsActive)
            .Include(x => x.Product).ThenInclude(x => x.Images)
            .OrderBy(x => x.Product.ProductName)
            .Select(x => new
            {
                productVariantId = x.Id,
                productName = x.Product.ProductName,
                reference = x.Product.Reference,
                x.Barcode,
                imageUrl = x.Product.Images
                    .OrderByDescending(i => i.IsPrimary)
                    .ThenBy(i => i.Id)
                    .Select(i => i.ImagePath)
                    .FirstOrDefault(),
                quantity = x.CurrentStock
            })
            .ToListAsync();

        var allPurchases = await _db.StockPurchases
            .Select(x => new { x.ProductVariantId, x.Quantity, x.UnitPurchasePrice, x.PurchaseDate, x.Id })
            .ToListAsync();

        var inventory = inventoryBase.Select(x =>
        {
            var purchases = allPurchases.Where(p => p.ProductVariantId == x.productVariantId).ToList();
            var latest = purchases.OrderByDescending(p => p.PurchaseDate).ThenByDescending(p => p.Id).FirstOrDefault();
            return new
            {
                x.productVariantId,
                x.productName,
                x.reference,
                x.Barcode,
                x.imageUrl,
                x.quantity,
                purchasedQuantity = purchases.Sum(p => p.Quantity),
                unitPurchasePrice = latest?.UnitPurchasePrice ?? 0,
                totalAmount = purchases.Sum(p => p.UnitPurchasePrice * p.Quantity),
                alreadyPaid = purchases.Count == 0
            };
        }).ToList();

        return Ok(new
        {
            items,
            totalAmount = items.Sum(x => x.totalAmount),
            totalQuantity = items.Sum(x => x.Quantity),
            inventory,
            inventoryTotalAmount = inventory.Sum(x => x.totalAmount),
            inventoryTotalQuantity = inventory.Sum(x => Math.Max(0, x.quantity)),
            purchasedTotalQuantity = inventory.Sum(x => x.purchasedQuantity)
        });
    }

    [HttpPost]
    public async Task<IActionResult> Create(CreateStockPurchaseRequest request)
    {
        if (request.Quantity <= 0)
            return BadRequest(new { message = "Quantite obligatoire" });
        if (request.UnitPurchasePrice < 0)
            return BadRequest(new { message = "Prix d'achat invalide" });

        var variant = await _db.ProductVariants
            .Include(x => x.Product)
            .FirstOrDefaultAsync(x => x.Id == request.ProductVariantId && x.IsActive);
        if (variant is null)
            return NotFound(new { message = "Article introuvable" });

        var purchase = new StockPurchase
        {
            ProductVariantId = variant.Id,
            Quantity = request.Quantity,
            UnitPurchasePrice = request.UnitPurchasePrice,
            PurchaseDate = request.PurchaseDate?.Date ?? DateTime.UtcNow,
            Notes = request.Notes?.Trim()
        };

        variant.CurrentStock += request.Quantity;
        variant.PurchasePrice = request.UnitPurchasePrice;
        variant.UpdatedAt = DateTime.UtcNow;
        _db.StockPurchases.Add(purchase);
        await _db.SaveChangesAsync();

        return Ok(new { purchase.Id, productName = variant.Product.ProductName, variant.CurrentStock });
    }
}
