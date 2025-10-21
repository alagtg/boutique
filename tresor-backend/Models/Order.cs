// Models/Order.cs
namespace Tresor.Api.Models
{
    public enum OrderStatus { Pending, Confirmed, Shipped, Delivered, Canceled }
    public enum CallStatus { None, Answered, NoAnswer }

    public class Order
    {
        public int Id { get; set; }
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

        public string CustomerName { get; set; } = "";
        public string Phone { get; set; } = "";
        public string? Address { get; set; }
        public string? Note { get; set; }

        public List<OrderItem> Items { get; set; } = new();

        public decimal Total => Items.Sum(i => i.UnitPrice * i.Quantity);

        // nouveaux champs
        public OrderStatus Status { get; set; } = OrderStatus.Pending;
        public CallStatus CallStatus { get; set; } = CallStatus.None;
        public DateTime? CalledAt { get; set; }
    }
}
