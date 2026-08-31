namespace Tresor.Api.Models;

public class AuditLog : BaseEntity
{
    public int? UserId { get; set; }
    public string ModuleName { get; set; } = string.Empty;
    public string ActionType { get; set; } = string.Empty;
    public string EntityName { get; set; } = string.Empty;
    public string EntityId { get; set; } = string.Empty;
    public string? Description { get; set; }
}
