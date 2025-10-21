
namespace Tresor.Api.DTOs
{
    public class CreateOrderDto
    {
        public string CustomerName { get; set; } = string.Empty;
        public string Phone { get; set; } = string.Empty;
        public string Address { get; set; } = string.Empty;
        public string? Note { get; set; }
        public List<CreateOrderItemDto> Items { get; set; } = new();
    }
    public class CreateOrderItemDto
    {
        public int ProductId { get; set; }
        public string Size { get; set; } = "M";
        public string Color { get; set; } = "Beige";
        public int Quantity { get; set; } = 1;
        public decimal UnitPrice { get; set; }
    }
}
