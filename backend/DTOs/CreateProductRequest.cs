namespace Tresor.Api.DTOs;

public class CreateProductRequest
{
    public string ProductName { get; set; } = string.Empty;
    public string? Reference { get; set; }
    public string? Description { get; set; }
    public int CategoryId { get; set; }
    public int? BrandId { get; set; }
    public DateTime? PurchaseDate { get; set; }
    public CreateVariantRequest Variant { get; set; } = new();
}

public class CreateVariantRequest
{
    public int Id { get; set; }
    public string? SKU { get; set; }
    public string? Barcode { get; set; }
    public string? Color { get; set; }
    public string? Size { get; set; }
    public decimal PurchasePrice { get; set; }
    public decimal SalePrice { get; set; }
    public int CurrentStock { get; set; }
    public int MinStock { get; set; } = 3;
}
