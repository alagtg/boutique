using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Tresor.Api.Data;
using Tresor.Api.DTOs;
using Tresor.Api.Models;

namespace Tresor.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class CustomersController : ControllerBase
{
    private readonly AppDbContext _db;

    public CustomersController(AppDbContext db)
    {
        _db = db;
    }

    [HttpGet]
    [Authorize]
    public async Task<IActionResult> GetAll()
    {
        var customers = await _db.Customers
            .Include(c => c.LoyaltyAccount)
            .Include(c => c.Vouchers)
            .Include(c => c.Sales)
            .OrderByDescending(c => c.CreatedAt)
            .Select(c => new
            {
                c.Id,
                c.FirstName,
                c.LastName,
                c.Phone,
                c.Email,
                c.City,
                c.QrCodeToken,
                c.VipStatus,
                c.TotalSpentLifetime,
                c.TotalSpentCurrentMonth,
                c.CurrentCreditAmount,
                loyalty = c.LoyaltyAccount == null ? null : new
                {
                    c.LoyaltyAccount.PointsBalance,
                    c.LoyaltyAccount.TierLevel
                },
                vouchers = c.Vouchers.Select(v => new
                {
                    v.Id,
                    v.Code,
                    v.Value,
                    v.Status,
                    v.MinPurchaseAmount,
                    v.ExpiresAt
                }),
                lastPurchases = c.Sales
                    .OrderByDescending(s => s.SaleDate)
                    .Take(5)
                    .Select(s => new
                    {
                        s.Id,
                        s.SaleNumber,
                        s.SaleDate,
                        s.TotalAmount
                    })
            })
            .ToListAsync();

        return Ok(customers);
    }

    [HttpGet("{id}")]
    [Authorize]
    public async Task<IActionResult> Get(int id)
    {
        var customer = await _db.Customers
            .Include(c => c.LoyaltyAccount)
            .Include(c => c.Vouchers)
            .Include(c => c.Sales)
                .ThenInclude(s => s.Lines)
                .ThenInclude(l => l.ProductVariant)
                .ThenInclude(v => v.Product)
            .FirstOrDefaultAsync(c => c.Id == id);

        if (customer is null) return NotFound();

        return Ok(new
        {
            customer.Id,
            customer.FirstName,
            customer.LastName,
            customer.Phone,
            customer.Email,
            customer.City,
            customer.QrCodeToken,
            customer.VipStatus,
            customer.TotalSpentLifetime,
            customer.TotalSpentCurrentMonth,
            customer.CurrentCreditAmount,
            loyalty = customer.LoyaltyAccount == null ? null : new
            {
                customer.LoyaltyAccount.PointsBalance,
                customer.LoyaltyAccount.TierLevel
            },
            vouchers = customer.Vouchers.Select(v => new
            {
                v.Id,
                v.Code,
                v.Value,
                v.Status,
                v.MinPurchaseAmount,
                v.ExpiresAt
            }),
            salesHistory = customer.Sales.OrderByDescending(s => s.SaleDate).Select(s => new
            {
                s.Id,
                s.SaleNumber,
                s.SaleDate,
                s.TotalAmount,
                lines = s.Lines.Select(l => new
                {
                    l.ProductVariantId,
                    productName = l.ProductVariant.Product.ProductName,
                    l.Quantity,
                    l.UnitPrice,
                    l.LineTotal
                })
            })
        });
    }

    [HttpPost]
    [Authorize]
    public async Task<IActionResult> Create(UpsertCustomerRequest request)
    {
        if (await _db.Customers.AnyAsync(c => c.Phone == request.Phone))
            return BadRequest(new { message = "Téléphone déjà enregistré" });

        var customer = new Customer
        {
            FirstName = request.FirstName,
            LastName = request.LastName,
            Phone = request.Phone,
            Email = request.Email,
            City = request.City,
            VipStatus = request.VipStatus,
            CurrentCreditAmount = request.CurrentCreditAmount,
            QrCodeToken = Guid.NewGuid().ToString("N")
        };

        _db.Customers.Add(customer);
        await _db.SaveChangesAsync();

        _db.LoyaltyAccounts.Add(new LoyaltyAccount
        {
            CustomerId = customer.Id,
            PointsBalance = 0,
            TierLevel = request.VipStatus ? "VIP" : "STANDARD"
        });
        await _db.SaveChangesAsync();

        return Ok(new
        {
            customer.Id,
            customer.FirstName,
            customer.LastName,
            customer.Phone,
            customer.QrCodeToken
        });
    }

    [HttpPut("{id:int}")]
    [Authorize]
    public async Task<IActionResult> Update(int id, UpsertCustomerRequest request)
    {
        var customer = await _db.Customers
            .Include(x => x.LoyaltyAccount)
            .FirstOrDefaultAsync(x => x.Id == id);

        if (customer is null)
            return NotFound(new { message = "Client introuvable" });

        var phone = request.Phone.Trim();
        if (await _db.Customers.AnyAsync(x => x.Id != id && x.Phone == phone))
            return BadRequest(new { message = "Telephone deja enregistre pour un autre client" });

        customer.FirstName = request.FirstName.Trim();
        customer.LastName = request.LastName.Trim();
        customer.Phone = phone;
        customer.Email = request.Email?.Trim();
        customer.City = request.City?.Trim();
        customer.VipStatus = request.VipStatus;
        customer.CurrentCreditAmount = request.CurrentCreditAmount;
        customer.UpdatedAt = DateTime.UtcNow;

        if (customer.LoyaltyAccount is not null)
        {
            customer.LoyaltyAccount.TierLevel = request.VipStatus ? "VIP" : "STANDARD";
            customer.LoyaltyAccount.UpdatedAt = DateTime.UtcNow;
        }

        await _db.SaveChangesAsync();
        return Ok(new
        {
            customer.Id,
            customer.FirstName,
            customer.LastName,
            customer.Phone,
            customer.Email,
            customer.City,
            customer.VipStatus,
            customer.CurrentCreditAmount
        });
    }

    [HttpPost("qr-register")]
    [AllowAnonymous]
    public async Task<IActionResult> QrRegister([FromBody] UpsertCustomerRequest request)
    {
        var existing = await _db.Customers.FirstOrDefaultAsync(c => c.Phone == request.Phone);
        if (existing is not null)
        {
            existing.FirstName = request.FirstName;
            existing.LastName = request.LastName;
            existing.Email = request.Email;
            existing.City = request.City;
            existing.UpdatedAt = DateTime.UtcNow;
            await _db.SaveChangesAsync();

            return Ok(new
            {
                message = "Client déjà existant, fiche mise à jour",
                customerId = existing.Id,
                existing.QrCodeToken
            });
        }

        var customer = new Customer
        {
            FirstName = request.FirstName,
            LastName = request.LastName,
            Phone = request.Phone,
            Email = request.Email,
            City = request.City,
            VipStatus = false,
            CurrentCreditAmount = 0,
            QrCodeToken = Guid.NewGuid().ToString("N")
        };

        _db.Customers.Add(customer);
        await _db.SaveChangesAsync();

        _db.LoyaltyAccounts.Add(new LoyaltyAccount
        {
            CustomerId = customer.Id,
            PointsBalance = 0,
            TierLevel = "STANDARD"
        });
        await _db.SaveChangesAsync();

        return Ok(new
        {
            message = "Inscription client enregistrée",
            customerId = customer.Id,
            customer.QrCodeToken
        });
    }
}
