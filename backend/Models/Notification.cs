namespace Tresor.Api.Models;

public class Notification : BaseEntity
{
    public int? UserId { get; set; }
    public string Title { get; set; } = string.Empty;
    public string Body { get; set; } = string.Empty;
    public string NotificationType { get; set; } = "INFO";
    public bool IsRead { get; set; }
}
