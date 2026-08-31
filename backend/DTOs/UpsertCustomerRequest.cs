namespace Tresor.Api.DTOs;

public class UpsertCustomerRequest
{
    public string FirstName { get; set; } = string.Empty;
    public string LastName { get; set; } = string.Empty;
    public string Phone { get; set; } = string.Empty;
    public string? Email { get; set; }
    public string? City { get; set; }
    public bool VipStatus { get; set; }
    public decimal CurrentCreditAmount { get; set; }
}
