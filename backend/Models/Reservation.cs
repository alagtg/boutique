namespace Tresor.Api.Models;

public class Reservation : BaseEntity
{
    public string ReservationNumber { get; set; } = string.Empty;
    public int CustomerId { get; set; }
    public Customer Customer { get; set; } = null!;
    public int CreatedByUserId { get; set; }
    public User CreatedByUser { get; set; } = null!;
    public DateTime ReservationDate { get; set; } = DateTime.UtcNow;
    public DateTime DueDate { get; set; }
    public decimal DepositAmount { get; set; }
    public decimal TotalAmount { get; set; }
    public decimal RemainingAmount { get; set; }
    public string Status { get; set; } = "RESERVED";
    public bool ReminderSent { get; set; }

    public ICollection<ReservationItem> Items { get; set; } = new List<ReservationItem>();
}
