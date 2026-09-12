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
public class ProductsController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly BarcodeService _barcodeService;
    private readonly IWebHostEnvironment _environment;

    public ProductsController(AppDbContext db, BarcodeService barcodeService, IWebHostEnvironment environment)
    {
        _db = db;
        _barcodeService = barcodeService;
        _environment = environment;
    }

    [HttpGet]
    public async Task<IActionResult> GetAll()
    {
        var isAdmin = User.IsInRole("ADMIN");

        var products = await _db.Products
            .Where(p => p.IsActive)
            .Include(p => p.Category)
            .Include(p => p.Brand)
            .Include(p => p.Variants)
            .Include(p => p.Images)
            .OrderByDescending(p => p.CreatedAt)
            .Select(p => new
            {
                p.Id,
                p.ProductName,
                p.Reference,
                p.CategoryId,
                p.BrandId,
                category = p.Category.Name,
                brand = p.Brand == null ? null : p.Brand.Name,
                imageUrl = p.Images
                    .OrderByDescending(i => i.IsPrimary)
                    .ThenBy(i => i.Id)
                    .Select(i => i.ImagePath)
                    .FirstOrDefault(),
                variants = p.Variants.Where(v => v.IsActive).Select(v => new
                {
                    v.Id,
                    v.SKU,
                    v.Barcode,
                    v.Color,
                    v.Size,
                    PurchasePrice = isAdmin ? v.PurchasePrice : 0,
                    v.SalePrice,
                    v.CurrentStock,
                    v.MinStock
                })
            })
            .ToListAsync();

        return Ok(products);
    }

    [HttpGet("categories")]
    public async Task<IActionResult> Categories()
        => Ok(await _db.Categories.OrderBy(x => x.Name).ToListAsync());

    [HttpPost("categories")]
    [Authorize(Roles = "ADMIN")]
    public async Task<IActionResult> CreateCategory([FromBody] CreateCategoryRequest request)
    {
        var name = request.Name.Trim();
        if (string.IsNullOrWhiteSpace(name))
            return BadRequest(new { message = "Nom type obligatoire" });

        var existing = await _db.Categories.FirstOrDefaultAsync(x => x.Name == name);
        if (existing is not null)
            return Ok(existing);

        var category = new Category { Name = name };
        _db.Categories.Add(category);
        await _db.SaveChangesAsync();
        return Ok(category);
    }

    [HttpPost]
    [Authorize(Roles = "ADMIN")]
    public async Task<IActionResult> Create(CreateProductRequest request)
    {
        var isAdmin = User.IsInRole("ADMIN");

        var product = new Product
        {
            ProductName = request.ProductName,
            Reference = request.Reference,
            Description = request.Description,
            CategoryId = request.CategoryId,
            BrandId = request.BrandId
        };

        var barcode = string.IsNullOrWhiteSpace(request.Variant.Barcode)
            ? _barcodeService.Generate()
            : request.Variant.Barcode.Trim();

        if (await _db.ProductVariants.AnyAsync(v => v.Barcode == barcode))
            return BadRequest(new { message = "Code-barres déjà utilisé" });

        var variant = new ProductVariant
        {
            SKU = string.IsNullOrWhiteSpace(request.Variant.SKU) ? _barcodeService.GenerateSku(request.ProductName) : request.Variant.SKU!,
            Barcode = barcode,
            Color = request.Variant.Color,
            Size = request.Variant.Size,
            PurchasePrice = isAdmin ? request.Variant.PurchasePrice : 0,
            SalePrice = request.Variant.SalePrice,
            CurrentStock = request.Variant.CurrentStock,
            MinStock = request.Variant.MinStock
        };
        product.Variants.Add(variant);

        _db.Products.Add(product);
        await _db.SaveChangesAsync();

        if (isAdmin && variant.CurrentStock > 0 && variant.PurchasePrice > 0)
        {
            _db.StockPurchases.Add(new StockPurchase
            {
                ProductVariantId = variant.Id,
                Quantity = variant.CurrentStock,
                UnitPurchasePrice = variant.PurchasePrice,
                PurchaseDate = request.PurchaseDate?.Date ?? DateTime.UtcNow,
                Notes = "Achat initial lors de la creation de l'article"
            });
            await _db.SaveChangesAsync();
        }

        return Ok(new
        {
            product.Id,
            product.ProductName,
            barcode
        });
    }

    [HttpPut("{id:int}")]
    [Authorize(Roles = "ADMIN")]
    public async Task<IActionResult> Update(int id, CreateProductRequest request)
    {
        var isAdmin = User.IsInRole("ADMIN");
        var product = await _db.Products
            .Include(p => p.Variants)
            .FirstOrDefaultAsync(p => p.Id == id && p.IsActive);

        if (product is null)
            return NotFound(new { message = "Produit introuvable" });

        var variant = product.Variants.FirstOrDefault(v => v.Id == request.Variant.Id) ?? product.Variants.FirstOrDefault();
        if (variant is null)
            return BadRequest(new { message = "Variante introuvable" });

        var barcode = string.IsNullOrWhiteSpace(request.Variant.Barcode)
            ? variant.Barcode
            : request.Variant.Barcode.Trim();

        if (await _db.ProductVariants.AnyAsync(v => v.Id != variant.Id && v.Barcode == barcode))
            return BadRequest(new { message = "Code-barres deja utilise" });

        product.ProductName = request.ProductName;
        product.Reference = request.Reference;
        product.Description = request.Description;
        product.CategoryId = request.CategoryId;
        product.BrandId = request.BrandId;
        product.UpdatedAt = DateTime.UtcNow;

        variant.Barcode = barcode;
        variant.Color = request.Variant.Color;
        variant.Size = request.Variant.Size;
        variant.SalePrice = request.Variant.SalePrice;
        variant.CurrentStock = request.Variant.CurrentStock;
        variant.MinStock = request.Variant.MinStock;
        variant.UpdatedAt = DateTime.UtcNow;

        await _db.SaveChangesAsync();
        return Ok(new { product.Id, product.ProductName, barcode = variant.Barcode });
    }

    [HttpDelete("{id:int}")]
    [Authorize(Roles = "ADMIN")]
    public async Task<IActionResult> Delete(int id)
    {
        var product = await _db.Products
            .Include(p => p.Variants)
            .FirstOrDefaultAsync(p => p.Id == id && p.IsActive);

        if (product is null)
            return NotFound(new { message = "Produit introuvable" });

        product.IsActive = false;
        product.UpdatedAt = DateTime.UtcNow;
        foreach (var variant in product.Variants)
        {
            variant.IsActive = false;
            variant.UpdatedAt = DateTime.UtcNow;
        }

        await _db.SaveChangesAsync();
        return Ok(new { message = "Produit supprime du catalogue" });
    }

    [HttpPost("{id:int}/image")]
    [Authorize(Roles = "ADMIN")]
    [RequestSizeLimit(8_000_000)]
    public async Task<IActionResult> UploadImage(int id, IFormFile file)
    {
        var product = await _db.Products
            .Include(p => p.Images)
            .FirstOrDefaultAsync(p => p.Id == id);

        if (product is null)
            return NotFound(new { message = "Produit introuvable" });

        if (file.Length == 0)
            return BadRequest(new { message = "Image vide" });

        var allowedExtensions = new[] { ".jpg", ".jpeg", ".png", ".webp" };
        var extension = Path.GetExtension(file.FileName).ToLowerInvariant();
        if (!allowedExtensions.Contains(extension))
            return BadRequest(new { message = "Format image accepte: JPG, PNG ou WEBP" });

        var uploadRoot = Path.Combine(_environment.WebRootPath ?? Path.Combine(_environment.ContentRootPath, "wwwroot"), "uploads", "products");
        Directory.CreateDirectory(uploadRoot);

        var fileName = $"{Guid.NewGuid():N}{extension}";
        var fullPath = Path.Combine(uploadRoot, fileName);
        await using (var stream = System.IO.File.Create(fullPath))
        {
            await file.CopyToAsync(stream);
        }

        foreach (var image in product.Images)
            image.IsPrimary = false;

        var imagePath = $"/uploads/products/{fileName}";
        _db.ProductImages.Add(new ProductImage
        {
            ProductId = product.Id,
            ImagePath = imagePath,
            IsPrimary = true
        });

        await _db.SaveChangesAsync();
        return Ok(new { imageUrl = imagePath });
    }
}

public class CreateCategoryRequest
{
    public string Name { get; set; } = string.Empty;
}
