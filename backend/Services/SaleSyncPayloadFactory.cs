using Microsoft.EntityFrameworkCore;
using Tresor.Api.Data;
using Tresor.Api.DTOs;
using Tresor.Api.Models;

namespace Tresor.Api.Services;

public sealed class SaleSyncPayloadFactory(AppDbContext db, InstallationOptions installation)
{
    public async Task<SaleSyncDto> CreateAsync(Sale sale, CancellationToken ct = default)
    {
        var user = await db.Users.SingleAsync(x => x.Id == sale.UserId, ct);
        var customer = sale.CustomerId is int customerId
            ? await db.Customers.SingleAsync(x => x.Id == customerId, ct) : null;
        if (customer != null && string.IsNullOrWhiteSpace(customer.QrCodeToken))
            customer.QrCodeToken = Guid.NewGuid().ToString("N");
        SyncCashSessionDto? sessionDto = null;
        if (sale.CashSessionId is int sessionId)
        {
            var session = await db.CashSessions.Include(x => x.Register).Include(x => x.OpenedByUser)
                .SingleAsync(x => x.Id == sessionId, ct);
            var closedBy = session.ClosedByUserId is int closedById
                ? (await db.Users.SingleAsync(x => x.Id == closedById, ct)).Username : null;
            sessionDto = new(session.SyncId, session.Register.RegisterName, session.Register.Location,
                session.OpenedByUser.Username, closedBy, session.OpeningAmount, session.OpenedAt,
                session.ClosedAt, session.CountedCashAmount, session.DifferenceAmount, session.Status);
        }
        var ids = sale.Lines.Select(x => x.ProductVariantId).ToList();
        var variants = await db.ProductVariants.Include(x => x.Product)
            .Where(x => ids.Contains(x.Id)).ToDictionaryAsync(x => x.Id, ct);
        return new SaleSyncDto
        {
            SyncId = sale.SyncId, NodeId = installation.NodeId, SaleNumber = sale.SaleNumber,
            Username = user.Username, SaleDate = sale.SaleDate, CreatedAt = sale.CreatedAt,
            SubtotalAmount = sale.SubtotalAmount, DiscountAmount = sale.DiscountAmount,
            DiscountReason = sale.DiscountReason, TotalAmount = sale.TotalAmount,
            PaidAmount = sale.PaidAmount, RemainingAmount = sale.RemainingAmount, SaleStatus = sale.SaleStatus,
            Customer = customer == null ? null : new(customer.QrCodeToken!, customer.FirstName,
                customer.LastName, customer.Phone, customer.Email, customer.City, customer.IsWhatsAppOptIn),
            CashSession = sessionDto,
            Lines = sale.Lines.Select(line =>
            {
                var variant = variants[line.ProductVariantId];
                return new SyncSaleLineDto(variant.Barcode, variant.Product.ProductName,
                    variant.Product.Reference, variant.Color, variant.Size, line.Quantity,
                    line.UnitPrice, line.DiscountAmount, line.LineTotal);
            }).ToList(),
            Payments = sale.Payments.Select(x => new SyncPaymentDto(x.PaymentMethod, x.Amount, x.CreatedAt)).ToList()
        };
    }
}
