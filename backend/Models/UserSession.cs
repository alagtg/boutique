namespace Tresor.Api.Models;

public class UserSession : BaseEntity
{
    public int UserId { get; set; }
    public User User { get; set; } = null!;
    public DateTime LoginAt { get; set; } = DateTime.UtcNow;
    public DateTime? LogoutAt { get; set; }
    public string? DeviceName { get; set; }
    public string? IpAddress { get; set; }
    public bool IsOpen { get; set; } = true;
}
