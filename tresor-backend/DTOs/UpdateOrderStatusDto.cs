// DTOs/UpdateOrderStatusDto.cs
namespace Tresor.Api.DTOs
{
    public class UpdateOrderStatusDto
    {
        public string Status { get; set; } = "pending"; // pending|confirmed|shipped|delivered|canceled
    }

    public class UpdateCallStatusDto
    {
        public string Status { get; set; } = "none"; // none|answered|noanswer
    }
}
