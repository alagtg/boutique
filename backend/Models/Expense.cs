namespace Tresor.Api.Models;

public class Expense : BaseEntity
{
    public int ExpenseCategoryId { get; set; }
    public ExpenseCategory? ExpenseCategory { get; set; }
    public DateTime ExpenseDate { get; set; } = DateTime.UtcNow;
    public decimal Amount { get; set; }
    public string PaymentMethod { get; set; } = "CASH";
    public string? SupplierName { get; set; }
    public string? Description { get; set; }
    public string? Remark { get; set; }
    public string? ReceiptImagePath { get; set; }
}
