using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Tresor.Api.Data;
using Tresor.Api.DTOs;
using Tresor.Api.Models;

namespace Tresor.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class ReservationsController : ControllerBase
{
    private readonly AppDbContext _db;

    public ReservationsController(AppDbContext db)
    {
        _db = db;
    }

    [HttpGet]
    public async Task<IActionResult> GetAll()
    {
        var today = DateTime.UtcNow.Date;
        var reservations = await _db.Reservations
            .Include(r => r.Customer)
            .Include(r => r.Items).ThenInclude(i => i.ProductVariant).ThenInclude(v => v.Product)
            .OrderByDescending(r => r.ReservationDate)
            .Select(r => new
            {
                r.Id,
                r.ReservationNumber,
                r.ReservationDate,
                r.DueDate,
                r.DepositAmount,
                r.TotalAmount,
                r.RemainingAmount,
                r.Status,
                late = r.Status == "RESERVED" && r.DueDate.Date <= today,
                customer = new
                {
                    r.Customer.Id,
                    r.Customer.FirstName,
                    r.Customer.LastName,
                    r.Customer.Phone
                },
                items = r.Items.Select(i => new
                {
                    i.ProductVariantId,
                    productName = i.ProductVariant.Product.ProductName,
                    barcode = i.ProductVariant.Barcode,
                    color = i.ProductVariant.Color,
                    size = i.ProductVariant.Size,
                    stockRestant = i.ProductVariant.CurrentStock,
                    i.Quantity,
                    i.UnitPrice,
                    i.LineTotal
                })
            })
            .ToListAsync();

        return Ok(reservations);
    }

    [HttpPost]
    public async Task<IActionResult> Create(CreateReservationRequest request)
    {
        if (request.Items.Count == 0)
            return BadRequest(new { message = "Aucun article réservé" });

        var requestedItems = request.Items
            .GroupBy(x => x.ProductVariantId)
            .Select(g => new
            {
                ProductVariantId = g.Key,
                Quantity = g.Sum(x => x.Quantity)
            })
            .ToList();

        var variantIds = requestedItems.Select(i => i.ProductVariantId).ToList();
        var variants = await _db.ProductVariants
            .Where(v => variantIds.Contains(v.Id))
            .ToListAsync();

        decimal total = 0;
        var reservation = new Reservation
        {
            ReservationNumber = $"R-{DateTime.UtcNow:yyyyMMddHHmmssfff}",
            CustomerId = request.CustomerId,
            CreatedByUserId = request.CreatedByUserId,
            DueDate = request.DueDate,
            DepositAmount = request.DepositAmount,
            ReservationDate = DateTime.UtcNow,
            Status = "RESERVED"
        };

        foreach (var item in requestedItems)
        {
            var variant = variants.FirstOrDefault(v => v.Id == item.ProductVariantId);
            if (variant is null) return BadRequest(new { message = $"Variante introuvable {item.ProductVariantId}" });
            if (variant.CurrentStock < item.Quantity) return BadRequest(new { message = $"Stock insuffisant {variant.Barcode}" });

            variant.CurrentStock -= item.Quantity;
            var lineTotal = variant.SalePrice * item.Quantity;
            total += lineTotal;

            reservation.Items.Add(new ReservationItem
            {
                ProductVariantId = variant.Id,
                Quantity = item.Quantity,
                UnitPrice = variant.SalePrice,
                LineTotal = lineTotal
            });
        }

        reservation.TotalAmount = total;
        reservation.RemainingAmount = total - request.DepositAmount;

        _db.Reservations.Add(reservation);
        await _db.SaveChangesAsync();

        return Ok(new
        {
            reservation.Id,
            reservation.ReservationNumber,
            reservation.TotalAmount,
            reservation.RemainingAmount,
            reservation.Status,
            message = $"{request.Items.Sum(x => x.Quantity)} article(s) reserve(s). Stock diminue automatiquement."
        });
    }

    [HttpPost("{id}/mark-paid")]
    public async Task<IActionResult> MarkPaid(int id)
    {
        var reservation = await _db.Reservations.FirstOrDefaultAsync(r => r.Id == id);
        if (reservation is null) return NotFound();

        reservation.Status = "PAID";
        reservation.RemainingAmount = 0;
        reservation.UpdatedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync();
        return Ok(new { reservation.Id, reservation.Status, reservation.RemainingAmount });
    }
}
