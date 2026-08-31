namespace Tresor.Api.Models;

public class ExpenseCategory : BaseEntity
{
    public string Name { get; set; } = string.Empty;
    public bool IsActive { get; set; } = true;
}
