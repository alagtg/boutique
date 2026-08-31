namespace Tresor.Api.Models;

public class Customer : BaseEntity
{
    public string FirstName { get; set; } = string.Empty;
    public string LastName { get; set; } = string.Empty;
    public string Phone { get; set; } = string.Empty;
    public string? Email { get; set; }
    public string? City { get; set; }
    public string? QrCodeToken { get; set; }
    public bool VipStatus { get; set; }
    public decimal TotalSpentLifetime { get; set; }
    public decimal TotalSpentCurrentMonth { get; set; }
    public decimal CurrentCreditAmount { get; set; }
    public bool IsWhatsAppOptIn { get; set; } = true;

    public LoyaltyAccount? LoyaltyAccount { get; set; }
    public ICollection<Voucher> Vouchers { get; set; } = new List<Voucher>();
    public ICollection<Sale> Sales { get; set; } = new List<Sale>();
    public ICollection<Reservation> Reservations { get; set; } = new List<Reservation>();
}
