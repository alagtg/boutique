
namespace Tresor.Api.DTOs
{
    public class ExpenseDto
    {
        public string Label { get; set; } = string.Empty;
        public decimal Amount { get; set; }
        public DateTime Date { get; set; } = DateTime.UtcNow;
        public string? Notes { get; set; }
    }
}
