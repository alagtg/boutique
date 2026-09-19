using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Tresor.Api.Data;
using Tresor.Api.DTOs;
using Tresor.Api.Models;
using Tresor.Api.Services;

namespace Tresor.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class ProductVariantsController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly BarcodeService _barcodeService;

    public ProductVariantsController(AppDbContext db, BarcodeService barcodeService)
    {
        _db = db;
        _barcodeService = barcodeService;
    }

    [HttpGet]
    public async Task<IActionResult> GetAll()
    {
        var items = await _db.ProductVariants
            .Include(v => v.Product)
            .OrderByDescending(v => v.CreatedAt)
            .ToListAsync();
        return Ok(items);
    }

    [HttpGet("new-barcode")]
    [Authorize(Roles = "ADMIN")]
    public async Task<IActionResult> NewBarcode()
    {
        string barcode;
        do { barcode = _barcodeService.Generate(); }
        while (await _db.ProductVariants.AnyAsync(x => x.Barcode == barcode));
        return Ok(new { barcode });
    }

    [HttpGet("barcode/{barcode}")]
    public async Task<IActionResult> GetByBarcode(string barcode)
    {
        barcode = barcode.Trim();
        var isAdmin = User.IsInRole("ADMIN");
        var item = await _db.ProductVariants
            .Include(v => v.Product)
            .Where(v => v.Barcode == barcode && v.IsActive && v.Product.IsActive)
            .Select(v => new
            {
                v.Id,
                v.SKU,
                v.Barcode,
                v.Color,
                v.Size,
                PurchasePrice = isAdmin ? v.PurchasePrice : 0,
                v.SalePrice,
                v.CurrentStock,
                v.MinStock,
                product = new
                {
                    v.Product.Id,
                    v.Product.ProductName,
                    v.Product.Reference
                }
            })
            .FirstOrDefaultAsync();
        return item is null ? NotFound(new { message = "Article introuvable" }) : Ok(item);
    }

    [HttpGet("lookup")]
    public Task<IActionResult> Lookup([FromQuery] string barcode) => GetByBarcode(barcode);

    [HttpPost]
    [Authorize(Roles = "ADMIN")]
    public async Task<IActionResult> Create([FromBody] CreateVariantRequest request, [FromQuery] int productId)
    {
        if (!await _db.Products.AnyAsync(p => p.Id == productId))
            return NotFound(new { message = "Produit introuvable" });

        var barcode = string.IsNullOrWhiteSpace(request.Barcode)
            ? _barcodeService.Generate()
            : request.Barcode.Trim();

        if (await _db.ProductVariants.AnyAsync(v => v.Barcode == barcode))
            return BadRequest(new { message = "Code-barres déjà utilisé" });

        if (!BarcodeService.IsPrintable(barcode))
            return BadRequest(new { message = "Code-barres : 1 a 40 caracteres ASCII sans espaces." });
        var variant = new ProductVariant
        {
            ProductId = productId,
            SKU = string.IsNullOrWhiteSpace(request.SKU) ? _barcodeService.GenerateSku("ARTICLE") : request.SKU!,
            Barcode = barcode,
            Color = request.Color,
            Size = request.Size,
            PurchasePrice = request.PurchasePrice,
            SalePrice = request.SalePrice,
            CurrentStock = request.CurrentStock,
            MinStock = request.MinStock
        };

        _db.ProductVariants.Add(variant);
        await _db.SaveChangesAsync();
        return Ok(variant);
    }
}
