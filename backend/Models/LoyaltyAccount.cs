namespace Tresor.Api.Models;

public class LoyaltyAccount : BaseEntity
{
    public int CustomerId { get; set; }
    public Customer Customer { get; set; } = null!;
    public int PointsBalance { get; set; }
    public string TierLevel { get; set; } = "STANDARD";
}
