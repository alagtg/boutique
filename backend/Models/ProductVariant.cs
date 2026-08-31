namespace Tresor.Api.Models;

public class ProductVariant : BaseEntity
{
    public int ProductId { get; set; }
    public Product Product { get; set; } = null!;
    public string SKU { get; set; } = string.Empty;
    public string Barcode { get; set; } = string.Empty;
    public string? Color { get; set; }
    public string? Size { get; set; }
    public decimal PurchasePrice { get; set; }
    public decimal SalePrice { get; set; }
    public int CurrentStock { get; set; }
    public int MinStock { get; set; } = 3;
    public bool IsReservable { get; set; } = true;
    public bool IsActive { get; set; } = true;

    public ICollection<SaleLine> SaleLines { get; set; } = new List<SaleLine>();
    public ICollection<ReservationItem> ReservationItems { get; set; } = new List<ReservationItem>();
    public ICollection<StockPurchase> StockPurchases { get; set; } = new List<StockPurchase>();
}
