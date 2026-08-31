namespace Tresor.Api.Models;

public class SalePayment : BaseEntity
{
    public int SaleId { get; set; }
    public Sale Sale { get; set; } = null!;
    public string PaymentMethod { get; set; } = "CASH";
    public decimal Amount { get; set; }
}
