namespace Tresor.Api.DTOs;

public class CreateReservationRequest
{
    public int CustomerId { get; set; }
    public int CreatedByUserId { get; set; }
    public DateTime DueDate { get; set; }
    public decimal DepositAmount { get; set; }
    public List<CreateReservationItemRequest> Items { get; set; } = new();
}

public class CreateReservationItemRequest
{
    public int ProductVariantId { get; set; }
    public int Quantity { get; set; }
}
