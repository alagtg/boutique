using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Tresor.Api.Data;

namespace Tresor.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class LoyaltyController : ControllerBase
{
    private readonly AppDbContext _db;

    public LoyaltyController(AppDbContext db)
    {
        _db = db;
    }

    [HttpGet("wheel-eligible")]
    [Authorize]
    public async Task<IActionResult> WheelEligible()
    {
        var settings = await _db.StoreSettings.OrderBy(x => x.Id).FirstOrDefaultAsync();
        var threshold = settings?.WheelEligibilityAmount ?? 300m;

        var customers = await _db.Customers
            .Where(c => c.TotalSpentCurrentMonth >= threshold)
            .OrderByDescending(c => (double)c.TotalSpentCurrentMonth)
            .Select(c => new
            {
                c.Id,
                c.FirstName,
                c.LastName,
                c.Phone,
                c.TotalSpentCurrentMonth,
                c.QrCodeToken,
                eligible = true,
                threshold
            })
            .ToListAsync();

        return Ok(customers);
    }

    [HttpGet("monthly-gift-candidates")]
    [Authorize]
    public async Task<IActionResult> MonthlyGiftCandidates([FromQuery] int? year = null, [FromQuery] int? month = null)
    {
        var now = DateTime.UtcNow;
        year ??= now.Year;
        month ??= now.Month;
        var settings = await _db.StoreSettings.OrderBy(x => x.Id).FirstOrDefaultAsync();

        var customers = await _db.Customers
            .Include(c => c.Sales)
            .Where(c => c.Sales.Any(s => s.SaleDate.Year == year && s.SaleDate.Month == month))
            .ToListAsync();

        var candidates = customers
            .Select(c => new
            {
                c.Id,
                c.FirstName,
                c.LastName,
                c.Phone,
                c.QrCodeToken,
                purchasesCount = c.Sales.Count(s => s.SaleDate.Year == year && s.SaleDate.Month == month),
                totalMonth = c.Sales
                    .Where(s => s.SaleDate.Year == year && s.SaleDate.Month == month)
                    .Sum(s => s.TotalAmount),
                gift = settings == null ? "Cadeau mensuel Tresor Boutique" : settings.MonthlyGiftPrize
            })
            .ToList();

        return Ok(candidates.OrderByDescending(c => c.totalMonth));
    }

    [HttpGet("monthly-gift-draw")]
    [Authorize]
    public async Task<IActionResult> MonthlyGiftDraw([FromQuery] int? year = null, [FromQuery] int? month = null)
    {
        var now = DateTime.UtcNow;
        year ??= now.Year;
        month ??= now.Month;
        var settings = await _db.StoreSettings.OrderBy(x => x.Id).FirstOrDefaultAsync();
        var gift = settings?.MonthlyGiftPrize ?? "Cadeau mensuel Tresor Boutique";

        var candidates = await _db.Customers
            .Where(c => c.Sales.Any(s => s.SaleDate.Year == year && s.SaleDate.Month == month))
            .Select(c => new
            {
                c.Id,
                c.FirstName,
                c.LastName,
                c.Phone,
                c.QrCodeToken
            })
            .ToListAsync();

        if (candidates.Count == 0)
            return Ok(new { winner = (object?)null, message = "Aucun client avec achat ce mois." });

        var winner = candidates[Random.Shared.Next(candidates.Count)];
        return Ok(new
        {
            winner,
            gift,
            message = $"Gagnant cadeau mensuel: {winner.FirstName} {winner.LastName} - {gift}"
        });
    }

    [HttpGet("wheel-token/{token}")]
    [AllowAnonymous]
    public async Task<IActionResult> WheelByToken(string token)
    {
        var customer = await _db.Customers
            .Include(c => c.LoyaltyAccount)
            .FirstOrDefaultAsync(c => c.QrCodeToken == token);

        if (customer is null)
            return NotFound(new { message = "Client introuvable" });

        return Ok(await BuildWheelCustomer(customer));
    }

    [HttpGet("wheel-phone")]
    [AllowAnonymous]
    public async Task<IActionResult> WheelByPhone([FromQuery] string phone)
    {
        var digits = new string((phone ?? string.Empty).Where(char.IsDigit).ToArray());
        if (string.IsNullOrWhiteSpace(digits))
            return BadRequest(new { message = "Telephone obligatoire" });

        var localDigits = digits.StartsWith("216") && digits.Length > 8 ? digits[3..] : digits;
        var customer = await _db.Customers
            .Include(c => c.LoyaltyAccount)
            .FirstOrDefaultAsync(c =>
                c.Phone.Replace(" ", "").Replace("-", "").Replace("+", "") == digits ||
                c.Phone.Replace(" ", "").Replace("-", "").Replace("+", "") == localDigits ||
                c.Phone.Replace(" ", "").Replace("-", "").Replace("+", "") == $"216{localDigits}");

        if (customer is null)
            return NotFound(new { message = "Client introuvable avec ce telephone" });

        return Ok(await BuildWheelCustomer(customer));
    }

    private async Task<object> BuildWheelCustomer(Tresor.Api.Models.Customer customer)
    {
        var settings = await _db.StoreSettings.OrderBy(x => x.Id).FirstOrDefaultAsync();
        var threshold = settings?.WheelEligibilityAmount ?? 300m;
        var prizes = (settings?.WheelPrizes ?? "Cadeau boutique|Reduction 10%|Bon achat 20 DT|Surprise prochaine visite")
            .Split('|', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);
        var eligible = customer.TotalSpentCurrentMonth >= threshold;
        return new
        {
            customer.Id,
            customer.FirstName,
            customer.LastName,
            customer.Phone,
            customer.TotalSpentCurrentMonth,
            points = customer.LoyaltyAccount == null ? 0 : customer.LoyaltyAccount.PointsBalance,
            tier = customer.LoyaltyAccount == null ? "STANDARD" : customer.LoyaltyAccount.TierLevel,
            eligible,
            threshold,
            prizes,
            message = eligible
                ? "Vous etes eligible a la roue de chance."
                : $"La roue est disponible a partir de {threshold:0.##} DT d'achats ce mois."
        };
    }
}
