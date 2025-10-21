
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.AspNetCore.Authorization;
using Tresor.Api.Data;
using Tresor.Api.DTOs;
using Tresor.Api.Models;

namespace Tresor.Api.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    [Authorize(Roles = "Admin")]
    public class ExpensesController : ControllerBase
    {
        private readonly AppDbContext _db;
        public ExpensesController(AppDbContext db) => _db = db;

        [HttpGet]
        public async Task<ActionResult<IEnumerable<Expense>>> GetAll() =>
            await _db.Expenses.OrderByDescending(e => e.Date).ToListAsync();

        [HttpPost]
        public async Task<ActionResult<Expense>> Create(ExpenseDto dto)
        {
            var e = new Expense { Label=dto.Label, Amount=dto.Amount, Date=dto.Date, Notes=dto.Notes };
            _db.Expenses.Add(e); await _db.SaveChangesAsync();
            return CreatedAtAction(nameof(GetAll), new { id = e.Id }, e);
        }

        [HttpDelete("{id:int}")]
        public async Task<IActionResult> Delete(int id)
        {
            var e = await _db.Expenses.FindAsync(id);
            if (e is null) return NotFound();
            _db.Expenses.Remove(e); await _db.SaveChangesAsync();
            return NoContent();
        }
    }
}
