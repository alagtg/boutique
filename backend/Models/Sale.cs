namespace Tresor.Api.Models;

public class Sale : BaseEntity
{
    public Guid SyncId { get; set; } = Guid.NewGuid();
    public bool IsSynced { get; set; }
    public DateTime? SyncedAt { get; set; }
    public int SyncAttempts { get; set; }
    public string? LastSyncError { get; set; }
    public string? SyncPayload { get; set; }
    public string SaleNumber { get; set; } = string.Empty;
    public int UserId { get; set; }
    public User User { get; set; } = null!;
    public int? CustomerId { get; set; }
    public Customer? Customer { get; set; }
    public int? CashSessionId { get; set; }
    public CashSession? CashSession { get; set; }
    public DateTime SaleDate { get; set; } = DateTime.UtcNow;
    public decimal SubtotalAmount { get; set; }
    public decimal DiscountAmount { get; set; }
    public string? DiscountReason { get; set; }
    public decimal TotalAmount { get; set; }
    public decimal PaidAmount { get; set; }
    public decimal RemainingAmount { get; set; }
    public string SaleStatus { get; set; } = "COMPLETED";

    public ICollection<SaleLine> Lines { get; set; } = new List<SaleLine>();
    public ICollection<SalePayment> Payments { get; set; } = new List<SalePayment>();
}
