using System.ComponentModel.DataAnnotations;

namespace Tresor.Api.DTOs;

public sealed class SaleSyncDto
{
    public Guid SyncId { get; set; }
    [Required, MaxLength(64)] public string NodeId { get; set; } = "";
    [Required, MaxLength(100)] public string SaleNumber { get; set; } = "";
    [Required, MaxLength(100)] public string Username { get; set; } = "";
    public DateTime SaleDate { get; set; }
    public DateTime CreatedAt { get; set; }
    public decimal SubtotalAmount { get; set; }
    public decimal DiscountAmount { get; set; }
    public string? DiscountReason { get; set; }
    public decimal TotalAmount { get; set; }
    public decimal PaidAmount { get; set; }
    public decimal RemainingAmount { get; set; }
    public string SaleStatus { get; set; } = "COMPLETED";
    public SyncCustomerDto? Customer { get; set; }
    public SyncCashSessionDto? CashSession { get; set; }
    [MinLength(1), MaxLength(1000)] public List<SyncSaleLineDto> Lines { get; set; } = [];
    [MaxLength(100)] public List<SyncPaymentDto> Payments { get; set; } = [];
}

public sealed record SyncCustomerDto(string QrCodeToken, string FirstName, string LastName,
    string Phone, string? Email, string? City, bool IsWhatsAppOptIn);
public sealed record SyncSaleLineDto(string Barcode, string ProductName, string? ProductReference,
    string? Color, string? Size, int Quantity, decimal UnitPrice, decimal DiscountAmount, decimal LineTotal);
public sealed record SyncPaymentDto(string PaymentMethod, decimal Amount, DateTime CreatedAt);
public sealed record SyncCashSessionDto(Guid SyncId, string RegisterName, string? Location,
    string OpenedByUsername, string? ClosedByUsername, decimal OpeningAmount, DateTime OpenedAt,
    DateTime? ClosedAt, decimal? CountedCashAmount, decimal? DifferenceAmount, string Status);
public sealed record SaleSyncReceipt(Guid SyncId, bool AlreadyExists);
