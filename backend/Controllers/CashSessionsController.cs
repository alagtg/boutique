using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Tresor.Api.Data;
using Tresor.Api.Models;

namespace Tresor.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class CashSessionsController : ControllerBase
{
    private readonly AppDbContext _db;

    public CashSessionsController(AppDbContext db)
    {
        _db = db;
    }

    [HttpGet]
    public async Task<IActionResult> GetAll() =>
        Ok(await _db.CashSessions.Include(x => x.Register).OrderByDescending(x => x.OpenedAt).ToListAsync());

    [HttpPost("open")]
    public async Task<IActionResult> Open(CashSession session)
    {
        var hasOpenSession = await _db.CashSessions.AnyAsync(x =>
            x.RegisterId == session.RegisterId &&
            x.Status == "OPEN");

        if (hasOpenSession)
            return BadRequest(new { message = "Une caisse est déjà ouverte pour ce poste." });

        session.Status = "OPEN";
        session.OpenedAt = DateTime.UtcNow;
        _db.CashSessions.Add(session);
        await _db.SaveChangesAsync();
        return Ok(session);
    }

    [HttpPost("close/{id}")]
    public async Task<IActionResult> Close(int id, [FromBody] decimal countedCashAmount)
    {
        var session = await _db.CashSessions.FirstOrDefaultAsync(x => x.Id == id);
        if (session is null) return NotFound();

        session.CountedCashAmount = countedCashAmount;
        session.DifferenceAmount = countedCashAmount - session.OpeningAmount;
        session.ClosedAt = DateTime.UtcNow;
        session.Status = "CLOSED";
        await _db.SaveChangesAsync();
        return Ok(session);
    }
}
