
namespace Tresor.Api.Models
{
    public class Expense
    {
        public int Id { get; set; }
        public string Label { get; set; } = string.Empty;
        public decimal Amount { get; set; } // négatif pour dépense
        public DateTime Date { get; set; } = DateTime.UtcNow;
        public string? Notes { get; set; }
    }
}
