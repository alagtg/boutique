namespace Tresor.Api.DTOs;

public class CreateStockPurchaseRequest
{
    public int ProductVariantId { get; set; }
    public int Quantity { get; set; }
    public decimal UnitPurchasePrice { get; set; }
    public DateTime? PurchaseDate { get; set; }
    public string? Notes { get; set; }
}
