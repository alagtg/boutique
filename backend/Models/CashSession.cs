namespace Tresor.Api.Models;

public class CashSession : BaseEntity
{
    public Guid SyncId { get; set; } = Guid.NewGuid();
    public int RegisterId { get; set; }
    public Register Register { get; set; } = null!;
    public int OpenedByUserId { get; set; }
    public User OpenedByUser { get; set; } = null!;
    public decimal OpeningAmount { get; set; }
    public DateTime OpenedAt { get; set; } = DateTime.UtcNow;
    public int? ClosedByUserId { get; set; }
    public decimal? CountedCashAmount { get; set; }
    public decimal? DifferenceAmount { get; set; }
    public DateTime? ClosedAt { get; set; }
    public string Status { get; set; } = "OPEN";

    public ICollection<Sale> Sales { get; set; } = new List<Sale>();
}
