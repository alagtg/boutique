using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Tresor.Api.Data;
using Tresor.Api.DTOs;
using Tresor.Api.Models;
using Tresor.Api.Services;
using System.Security.Claims;
using System.Text.Json;

namespace Tresor.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class SalesController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly InstallationOptions _installation;
    private readonly SaleSyncPayloadFactory _payloadFactory;
    private readonly CustomerSaleEffects _customerEffects;
    private readonly SalesSyncSignal _syncSignal;

    public SalesController(AppDbContext db, InstallationOptions installation,
        SaleSyncPayloadFactory payloadFactory, CustomerSaleEffects customerEffects, SalesSyncSignal syncSignal)
    {
        _db = db;
        _installation = installation;
        _payloadFactory = payloadFactory;
        _customerEffects = customerEffects;
        _syncSignal = syncSignal;
    }

    [HttpGet]
    [Authorize(Roles = "ADMIN")]
    public async Task<IActionResult> GetAll([FromQuery] int? year = null, [FromQuery] int? month = null, [FromQuery] DateTime? dateFrom = null, [FromQuery] DateTime? dateTo = null)
    {
        var query = _db.Sales
            .Include(s => s.User)
            .Include(s => s.Customer)
            .Include(s => s.Lines).ThenInclude(l => l.ProductVariant).ThenInclude(v => v.Product)
            .Include(s => s.Lines).ThenInclude(l => l.ProductVariant).ThenInclude(v => v.Product).ThenInclude(p => p.Images)
            .Include(s => s.Payments)
            .AsQueryable();

        if (year.HasValue)
            query = query.Where(s => s.SaleDate.Year == year.Value);

        if (month.HasValue)
            query = query.Where(s => s.SaleDate.Month == month.Value);

        if (dateFrom.HasValue)
            query = query.Where(s => s.SaleDate >= dateFrom.Value.Date);

        if (dateTo.HasValue)
            query = query.Where(s => s.SaleDate < dateTo.Value.Date);

        var sales = await query
            .OrderByDescending(s => s.SaleDate)
            .Select(s => new
            {
                s.Id,
                s.SaleNumber,
                s.SaleDate,
                employee = s.User.FullName,
                customer = s.Customer == null ? null : $"{s.Customer.FirstName} {s.Customer.LastName}",
                s.TotalAmount,
                s.SubtotalAmount,
                s.DiscountAmount,
                s.DiscountReason,
                s.PaidAmount,
                s.RemainingAmount,
                s.SaleStatus,
                lines = s.Lines.Select(l => new
                {
                    productName = l.ProductVariant.Product.ProductName,
                    imageUrl = l.ProductVariant.Product.Images
                        .OrderByDescending(i => i.IsPrimary)
                        .ThenBy(i => i.Id)
                        .Select(i => i.ImagePath)
                        .FirstOrDefault(),
                    l.Quantity,
                    l.UnitPrice,
                    l.DiscountAmount,
                    l.LineTotal
                }),
                payments = s.Payments.Select(p => new
                {
                    p.PaymentMethod,
                    p.Amount
                })
            })
            .ToListAsync();

        return Ok(sales);
    }

    [HttpGet("monthly-invoice")]
    [Authorize(Roles = "ADMIN")]
    public async Task<IActionResult> MonthlyInvoice([FromQuery] int? year = null, [FromQuery] int? month = null)
    {
        var now = DateTime.UtcNow;
        year ??= now.Year;
        month ??= now.Month;

        var sales = await _db.Sales
            .Include(s => s.User)
            .Include(s => s.Customer)
            .Include(s => s.Lines).ThenInclude(l => l.ProductVariant).ThenInclude(v => v.Product)
            .Include(s => s.Lines).ThenInclude(l => l.ProductVariant).ThenInclude(v => v.Product).ThenInclude(p => p.Images)
            .Include(s => s.Payments)
            .Where(s => s.SaleDate.Year == year && s.SaleDate.Month == month)
            .OrderByDescending(s => s.SaleDate)
            .ToListAsync();

        var salesTotal = sales.Sum(s => s.TotalAmount);
        var paidTotal = sales.Sum(s => s.PaidAmount);
        var byPaymentMethod = sales
            .SelectMany(s => s.Payments)
            .GroupBy(p => p.PaymentMethod)
            .Select(g => new { paymentMethod = g.Key, total = g.Sum(x => x.Amount) })
            .OrderByDescending(x => x.total)
            .ToList();

        var items = sales.Select(s => new
        {
            s.Id,
            s.SaleNumber,
            s.SaleDate,
            employee = s.User.FullName,
            customer = s.Customer == null ? "-" : $"{s.Customer.FirstName} {s.Customer.LastName}",
            s.TotalAmount,
            s.SubtotalAmount,
            s.DiscountAmount,
            s.DiscountReason,
            s.PaidAmount,
            s.RemainingAmount,
            lines = s.Lines.Select(l => new
            {
                productName = l.ProductVariant.Product.ProductName,
                imageUrl = l.ProductVariant.Product.Images
                    .OrderByDescending(i => i.IsPrimary)
                    .ThenBy(i => i.Id)
                    .Select(i => i.ImagePath)
                    .FirstOrDefault(),
                l.Quantity,
                l.UnitPrice,
                l.DiscountAmount,
                l.LineTotal
            })
        });

        return Ok(new
        {
            year,
            month,
            salesCount = sales.Count,
            salesTotal,
            paidTotal,
            remainingTotal = salesTotal - paidTotal,
            byPaymentMethod,
            items
        });
    }

    [HttpGet("profit-summary")]
    [Authorize(Roles = "ADMIN")]
    public async Task<IActionResult> ProfitSummary()
    {
        var today = DateTime.UtcNow.Date;
        var startOfWeek = today.AddDays(-(((int)today.DayOfWeek + 6) % 7));
        var startOfMonth = new DateTime(today.Year, today.Month, 1);

        var lines = await _db.SaleLines
            .Include(l => l.Sale)
            .Include(l => l.ProductVariant)
            .Where(l => l.Sale.SaleDate >= startOfMonth)
            .Select(l => new
            {
                l.Sale.SaleDate,
                l.Quantity,
                l.LineTotal,
                l.ProductVariant.PurchasePrice
            })
            .ToListAsync();

        object Build(DateTime start)
        {
            var scoped = lines.Where(x => x.SaleDate >= start).ToList();
            var salesTotal = scoped.Sum(x => x.LineTotal);
            var purchaseTotal = scoped.Sum(x => x.PurchasePrice * x.Quantity);
            return new
            {
                salesTotal,
                purchaseTotal,
                profit = salesTotal - purchaseTotal,
                quantity = scoped.Sum(x => x.Quantity)
            };
        }

        return Ok(new
        {
            today = Build(today),
            week = Build(startOfWeek),
            month = Build(startOfMonth)
        });
    }

    [HttpPost]
    [Authorize(Roles = "ADMIN,EMPLOYE")]
    public async Task<IActionResult> Create(CreateSaleRequest request)
    {
        if (request.Lines == null || request.Lines.Count == 0 || request.Lines.Any(x => x.Quantity <= 0) ||
            request.Payments == null || request.Payments.Any(x => x.Amount < 0))
            return BadRequest(new { message = "Aucune ligne de vente" });

        if (!int.TryParse(User.FindFirstValue(ClaimTypes.NameIdentifier), out var sellerId)) return Unauthorized();
        request.UserId = sellerId;
        await using var transaction = await _db.Database.BeginTransactionAsync(System.Data.IsolationLevel.Serializable);
        if (request.CustomerId is int customerId && !await _db.Customers.AnyAsync(x => x.Id == customerId))
            return BadRequest(new { message = "Client introuvable" });
        if (request.CashSessionId is int sessionId)
        {
            var session = await _db.CashSessions.SingleOrDefaultAsync(x => x.Id == sessionId);
            if (session == null || session.Status != "OPEN" || (!User.IsInRole("ADMIN") && session.OpenedByUserId != sellerId))
                return BadRequest(new { message = "Session de caisse non autorisee ou fermee" });
        }

        var requestedLines = request.Lines
            .GroupBy(x => x.ProductVariantId)
            .Select(g => new
            {
                ProductVariantId = g.Key,
                Quantity = g.Sum(x => x.Quantity)
            })
            .ToList();

        var requestedVariantIds = requestedLines.Select(x => x.ProductVariantId).ToList();
        var variants = await _db.ProductVariants
            .Where(v => requestedVariantIds.Contains(v.Id))
            .ToListAsync();

        foreach (var line in requestedLines)
        {
            var variant = variants.FirstOrDefault(v => v.Id == line.ProductVariantId);
            if (variant is null)
                return BadRequest(new { message = $"Variante introuvable: {line.ProductVariantId}" });

            if (variant.CurrentStock < line.Quantity)
                return BadRequest(new { message = $"Stock insuffisant pour {variant.Barcode}" });
        }

        decimal subtotal = 0;
        var sale = new Sale
        {
            SaleNumber = $"V-{DateTime.UtcNow:yyyyMMddHHmmssfff}-{Guid.NewGuid():N}",
            UserId = request.UserId,
            CustomerId = request.CustomerId,
            CashSessionId = request.CashSessionId,
            SaleDate = DateTime.UtcNow,
            SaleStatus = "COMPLETED"
        };

        foreach (var line in requestedLines)
        {
            var variant = variants.First(v => v.Id == line.ProductVariantId);
            var total = variant.SalePrice * line.Quantity;
            subtotal += total;
            variant.CurrentStock -= line.Quantity;

            sale.Lines.Add(new SaleLine
            {
                ProductVariantId = variant.Id,
                Quantity = line.Quantity,
                UnitPrice = variant.SalePrice,
                DiscountAmount = 0,
                LineTotal = total
            });
        }

        var discount = Math.Clamp(request.DiscountAmount, 0, subtotal);
        if (discount > 0 && string.IsNullOrWhiteSpace(request.DiscountReason))
            return BadRequest(new { message = "Motif de reduction obligatoire" });

        sale.SubtotalAmount = subtotal;
        sale.DiscountAmount = discount;
        sale.DiscountReason = discount > 0 ? request.DiscountReason?.Trim() : null;
        sale.TotalAmount = subtotal - discount;

        if (discount > 0 && subtotal > 0)
        {
            decimal allocated = 0;
            var lines = sale.Lines.ToList();
            for (var i = 0; i < lines.Count; i++)
            {
                var lineDiscount = i == lines.Count - 1
                    ? discount - allocated
                    : Math.Round(discount * (lines[i].LineTotal / subtotal), 2);
                lines[i].DiscountAmount = lineDiscount;
                lines[i].LineTotal -= lineDiscount;
                allocated += lineDiscount;
            }
        }
        sale.PaidAmount = request.Payments.Sum(p => p.Amount);
        sale.RemainingAmount = sale.TotalAmount - sale.PaidAmount;

        foreach (var payment in request.Payments)
        {
            sale.Payments.Add(new SalePayment
            {
                PaymentMethod = payment.PaymentMethod,
                Amount = payment.Amount
            });
        }

        _db.Sales.Add(sale);

        await _customerEffects.ApplyAsync(sale);
        if (_installation.IsCommerce)
            sale.SyncPayload = JsonSerializer.Serialize(await _payloadFactory.CreateAsync(sale));
        else
        {
            sale.IsSynced = true;
            sale.SyncedAt = DateTime.UtcNow;
        }

        await _db.SaveChangesAsync();
        await transaction.CommitAsync();
        if (_installation.IsCommerce) _syncSignal.Notify();
        return Ok(new
        {
            sale.Id,
            sale.SyncId,
            sale.IsSynced,
            sale.SaleNumber,
            sale.TotalAmount,
            sale.SubtotalAmount,
            sale.DiscountAmount,
            sale.DiscountReason,
            sale.PaidAmount,
            sale.RemainingAmount,
            sale.SaleDate
        });
    }
}
