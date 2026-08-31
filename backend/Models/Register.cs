namespace Tresor.Api.Models;

public class Register : BaseEntity
{
    public string RegisterName { get; set; } = string.Empty;
    public string? Location { get; set; }
    public bool IsActive { get; set; } = true;
}
