namespace Tresor.Api.DTOs;

public class CreateSaleRequest
{
    public int UserId { get; set; }
    public int? CustomerId { get; set; }
    public int? CashSessionId { get; set; }
    public decimal DiscountAmount { get; set; }
    public string? DiscountReason { get; set; }
    public List<CreateSaleLineRequest> Lines { get; set; } = new();
    public List<CreateSalePaymentRequest> Payments { get; set; } = new();
}

public class CreateSaleLineRequest
{
    public int ProductVariantId { get; set; }
    public int Quantity { get; set; }
}

public class CreateSalePaymentRequest
{
    public string PaymentMethod { get; set; } = "CASH";
    public decimal Amount { get; set; }
}
