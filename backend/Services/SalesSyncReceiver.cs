using System.Data;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Tresor.Api.Data;
using Tresor.Api.DTOs;
using Tresor.Api.Models;

namespace Tresor.Api.Services;

public sealed class SyncMappingException(string message) : Exception(message);

public sealed class SalesSyncReceiver(BackOfficeDbContext db, CustomerSaleEffects effects,
    ILogger<SalesSyncReceiver> logger)
{
    public async Task<SaleSyncReceipt> ReceiveAsync(SaleSyncDto dto, CancellationToken ct)
    {
        Validate(dto);
        if (await db.Sales.AnyAsync(x => x.SyncId == dto.SyncId, ct))
            return new(dto.SyncId, true);
        await using var transaction = await db.Database.BeginTransactionAsync(IsolationLevel.Serializable, ct);
        try
        {
            if (await db.Sales.AnyAsync(x => x.SyncId == dto.SyncId, ct))
                return new(dto.SyncId, true);
            var user = await db.Users.SingleOrDefaultAsync(x => x.Username == dto.Username, ct)
                ?? throw new SyncMappingException("Seller username is not provisioned in BackOffice.");
            Customer? customer = null;
            if (dto.Customer is { } info)
            {
                customer = await db.Customers.Include(x => x.LoyaltyAccount)
                    .SingleOrDefaultAsync(x => x.QrCodeToken == info.QrCodeToken, ct);
                if (customer == null)
                {
                    // Phone is deliberately not an identity: it is neither unique nor immutable in this project.
                    customer = new Customer { QrCodeToken = info.QrCodeToken, FirstName = info.FirstName,
                        LastName = info.LastName, Phone = info.Phone, Email = info.Email, City = info.City,
                        IsWhatsAppOptIn = info.IsWhatsAppOptIn,
                        LoyaltyAccount = new LoyaltyAccount { TierLevel = "STANDARD" } };
                    db.Customers.Add(customer);
                }
            }
            var sale = new Sale
            {
                SyncId = dto.SyncId, SaleNumber = dto.SaleNumber, User = user, Customer = customer,
                CashSession = await MapSessionAsync(dto, ct), SaleDate = dto.SaleDate, CreatedAt = dto.CreatedAt,
                SubtotalAmount = dto.SubtotalAmount, DiscountAmount = dto.DiscountAmount,
                DiscountReason = dto.DiscountReason, TotalAmount = dto.TotalAmount,
                PaidAmount = dto.PaidAmount, RemainingAmount = dto.RemainingAmount, SaleStatus = dto.SaleStatus,
                IsSynced = true, SyncedAt = DateTime.UtcNow, SyncPayload = JsonSerializer.Serialize(dto)
            };
            var barcodes = dto.Lines.Select(x => x.Barcode).Distinct().ToList();
            var variants = await db.ProductVariants.Where(x => barcodes.Contains(x.Barcode)).ToDictionaryAsync(x => x.Barcode, ct);
            foreach (var line in dto.Lines)
            {
                if (!variants.TryGetValue(line.Barcode, out var variant))
                    throw new SyncMappingException("A barcode is missing from the BackOffice catalogue.");
                sale.Lines.Add(new SaleLine { ProductVariant = variant, Quantity = line.Quantity,
                    UnitPrice = line.UnitPrice, DiscountAmount = line.DiscountAmount, LineTotal = line.LineTotal });
                // A completed offline sale remains valid even if central stock has since changed.
                variant.CurrentStock -= line.Quantity;
            }
            foreach (var payment in dto.Payments)
                sale.Payments.Add(new SalePayment { PaymentMethod = payment.PaymentMethod,
                    Amount = payment.Amount, CreatedAt = payment.CreatedAt });
            db.Sales.Add(sale);
            await effects.ApplyAsync(sale, ct);
            await db.SaveChangesAsync(ct);
            await transaction.CommitAsync(ct);
            logger.LogInformation("Received sale {SyncId} from {NodeId}", dto.SyncId, dto.NodeId);
            return new(dto.SyncId, false);
        }
        catch (DbUpdateException)
        {
            await transaction.RollbackAsync(ct);
            db.ChangeTracker.Clear();
            // The unique database index handles requests racing on different API instances.
            if (await db.Sales.AnyAsync(x => x.SyncId == dto.SyncId, ct)) return new(dto.SyncId, true);
            throw;
        }
    }

    private async Task<CashSession?> MapSessionAsync(SaleSyncDto dto, CancellationToken ct)
    {
        if (dto.CashSession is not { } info) return null;
        var existing = await db.CashSessions.SingleOrDefaultAsync(x => x.SyncId == info.SyncId, ct);
        if (existing != null) return existing;
        var openedBy = await db.Users.SingleOrDefaultAsync(x => x.Username == info.OpenedByUsername, ct)
            ?? throw new SyncMappingException("Cash session opener is not provisioned.");
        var closedBy = info.ClosedByUsername == null ? null
            : await db.Users.SingleOrDefaultAsync(x => x.Username == info.ClosedByUsername, ct)
                ?? throw new SyncMappingException("Cash session closer is not provisioned.");
        var name = $"{dto.NodeId}/{info.RegisterName}";
        var registers = await db.Registers.Where(x => x.RegisterName == name).ToListAsync(ct);
        if (registers.Count > 1) throw new SyncMappingException("Ambiguous register mapping.");
        var register = registers.SingleOrDefault() ?? new Register { RegisterName = name, Location = info.Location };
        return new CashSession { SyncId = info.SyncId, Register = register, OpenedByUser = openedBy,
            ClosedByUserId = closedBy?.Id, OpeningAmount = info.OpeningAmount, OpenedAt = info.OpenedAt,
            ClosedAt = info.ClosedAt, CountedCashAmount = info.CountedCashAmount,
            DifferenceAmount = info.DifferenceAmount, Status = info.Status };
    }

    private static void Validate(SaleSyncDto dto)
    {
        if (dto.SyncId == Guid.Empty || string.IsNullOrWhiteSpace(dto.NodeId) || dto.NodeId.Length > 64 ||
            string.IsNullOrWhiteSpace(dto.SaleNumber) || string.IsNullOrWhiteSpace(dto.Username) ||
            dto.SaleDate == default || dto.SaleDate.Kind == DateTimeKind.Local || dto.CreatedAt == default ||
            dto.Lines == null || dto.Lines.Count is < 1 or > 1000 || dto.Payments == null || dto.Payments.Count > 100 ||
            dto.Lines.Any(x => string.IsNullOrWhiteSpace(x.Barcode) || x.Quantity <= 0 || x.UnitPrice < 0 ||
                x.DiscountAmount < 0 || x.LineTotal < 0 || x.LineTotal != x.Quantity * x.UnitPrice - x.DiscountAmount) ||
            dto.Payments.Any(x => string.IsNullOrWhiteSpace(x.PaymentMethod) || x.Amount < 0) ||
            dto.SubtotalAmount != dto.Lines.Sum(x => x.Quantity * x.UnitPrice) ||
            dto.DiscountAmount != dto.Lines.Sum(x => x.DiscountAmount) ||
            dto.TotalAmount != dto.SubtotalAmount - dto.DiscountAmount ||
            dto.PaidAmount != dto.Payments.Sum(x => x.Amount) || dto.RemainingAmount != dto.TotalAmount - dto.PaidAmount ||
            dto.Customer is { } customer && (string.IsNullOrWhiteSpace(customer.QrCodeToken) || customer.QrCodeToken.Length > 100) ||
            dto.CashSession is { SyncId: var sessionId } && sessionId == Guid.Empty)
            throw new SyncMappingException("Invalid or inconsistent sale payload.");
    }
}
