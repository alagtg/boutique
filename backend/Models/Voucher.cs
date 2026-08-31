namespace Tresor.Api.Models;

public class Voucher : BaseEntity
{
    public int CustomerId { get; set; }
    public Customer Customer { get; set; } = null!;
    public string Code { get; set; } = string.Empty;
    public string VoucherType { get; set; } = "AMOUNT";
    public decimal Value { get; set; }
    public decimal? MinPurchaseAmount { get; set; }
    public DateTime IssuedAt { get; set; } = DateTime.UtcNow;
    public DateTime? ExpiresAt { get; set; }
    public DateTime? UsedAt { get; set; }
    public string Status { get; set; } = "ACTIVE";
}
