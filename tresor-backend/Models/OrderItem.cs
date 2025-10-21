
namespace Tresor.Api.Models
{
    public class OrderItem
    {
        public int Id { get; set; }
        public int ProductId { get; set; }
        public Product? Product { get; set; }
        public string Size { get; set; } = "M";
        public string Color { get; set; } = "Beige";
        public int Quantity { get; set; } = 1;
        public decimal UnitPrice { get; set; }
        public int OrderId { get; set; }
        public Order? Order { get; set; }
    }
}
