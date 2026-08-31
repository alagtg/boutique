using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Tresor.Api.Data;
using Tresor.Api.Models;

namespace Tresor.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class SettingsController : ControllerBase
{
    private readonly AppDbContext _db;

    public SettingsController(AppDbContext db)
    {
        _db = db;
    }

    [HttpGet("store")]
    public async Task<IActionResult> GetStore()
    {
        var store = await _db.StoreSettings.OrderBy(x => x.Id).FirstOrDefaultAsync();
        return Ok(store);
    }

    [HttpPut("store")]
    [Authorize(Roles = "ADMIN")]
    public async Task<IActionResult> UpdateStore([FromBody] StoreSetting payload)
    {
        var store = await _db.StoreSettings.OrderBy(x => x.Id).FirstOrDefaultAsync();
        if (store is null)
        {
            _db.StoreSettings.Add(payload);
            await _db.SaveChangesAsync();
            return Ok(payload);
        }

        store.StoreName = payload.StoreName;
        store.PrimaryColor = payload.PrimaryColor;
        store.SecondaryColor = payload.SecondaryColor;
        store.BackgroundColor = payload.BackgroundColor;
        store.TextColor = payload.TextColor;
        store.Phone = payload.Phone;
        store.WhatsAppNumber = payload.WhatsAppNumber;
        store.Address = payload.Address;
        store.ReceiptFooterMessage = payload.ReceiptFooterMessage;
        store.WheelEligibilityAmount = payload.WheelEligibilityAmount;
        store.WheelPrizes = payload.WheelPrizes;
        store.MonthlyGiftPrize = payload.MonthlyGiftPrize;
        store.MonthlyGiftReminderMessage = payload.MonthlyGiftReminderMessage;
        store.ReservationReminderDaysDefault = payload.ReservationReminderDaysDefault;
        store.EmployeeMaxDiscountPercent = payload.EmployeeMaxDiscountPercent;
        store.UpdatedAt = DateTime.UtcNow;

        await _db.SaveChangesAsync();
        return Ok(store);
    }
}
