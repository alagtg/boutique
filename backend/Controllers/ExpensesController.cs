using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Tresor.Api.Data;
using Tresor.Api.Models;

namespace Tresor.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize(Roles = "ADMIN")]
public class ExpensesController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly IWebHostEnvironment _environment;

    public ExpensesController(AppDbContext db, IWebHostEnvironment environment)
    {
        _db = db;
        _environment = environment;
    }

    [HttpGet]
    public async Task<IActionResult> GetAll([FromQuery] int? year = null, [FromQuery] int? month = null)
    {
        var query = _db.Expenses.Include(x => x.ExpenseCategory).AsQueryable();

        if (year.HasValue)
            query = query.Where(x => x.ExpenseDate.Year == year.Value);

        if (month.HasValue)
            query = query.Where(x => x.ExpenseDate.Month == month.Value);

        var items = await query
            .OrderByDescending(x => x.ExpenseDate)
            .Select(x => new
            {
                x.Id,
                x.ExpenseDate,
                x.Amount,
                x.PaymentMethod,
                x.SupplierName,
                x.Description,
                x.Remark,
                receiptImageUrl = x.ReceiptImagePath,
                category = x.ExpenseCategory!.Name
            })
            .ToListAsync();

        return Ok(items);
    }

    [HttpGet("categories")]
    public async Task<IActionResult> Categories()
        => Ok(await _db.ExpenseCategories.OrderBy(x => x.Name).ToListAsync());

    [HttpGet("monthly-report")]
    public async Task<IActionResult> MonthlyReport([FromQuery] int? year = null, [FromQuery] int? month = null)
    {
        var now = DateTime.UtcNow;
        year ??= now.Year;
        month ??= now.Month;

        var items = await _db.Expenses
            .Include(x => x.ExpenseCategory)
            .Where(x => x.ExpenseDate.Year == year && x.ExpenseDate.Month == month)
            .OrderByDescending(x => x.ExpenseDate)
            .Select(x => new
            {
                x.Id,
                x.ExpenseDate,
                x.Amount,
                x.PaymentMethod,
                x.SupplierName,
                x.Description,
                x.Remark,
                receiptImageUrl = x.ReceiptImagePath,
                category = x.ExpenseCategory!.Name
            })
            .ToListAsync();

        var total = items.Sum(x => x.Amount);
        var byCategory = items.GroupBy(x => x.category)
            .Select(g => new { category = g.Key, total = g.Sum(x => x.Amount) })
            .OrderByDescending(x => x.total)
            .ToList();

        return Ok(new
        {
            year,
            month,
            total,
            byCategory,
            items
        });
    }

    [HttpPost]
    public async Task<IActionResult> Create(Expense expense)
    {
        _db.Expenses.Add(expense);
        await _db.SaveChangesAsync();
        return Ok(expense);
    }

    [HttpPost("{id:int}/receipt")]
    [RequestSizeLimit(8_000_000)]
    public async Task<IActionResult> UploadReceipt(int id, IFormFile file)
    {
        var expense = await _db.Expenses.FirstOrDefaultAsync(x => x.Id == id);
        if (expense is null)
            return NotFound(new { message = "Depense introuvable" });

        if (file.Length == 0)
            return BadRequest(new { message = "Image vide" });

        var allowedExtensions = new[] { ".jpg", ".jpeg", ".png", ".webp" };
        var extension = Path.GetExtension(file.FileName).ToLowerInvariant();
        if (!allowedExtensions.Contains(extension))
            return BadRequest(new { message = "Format image accepte: JPG, PNG ou WEBP" });

        var uploadRoot = Path.Combine(_environment.WebRootPath ?? Path.Combine(_environment.ContentRootPath, "wwwroot"), "uploads", "expenses");
        Directory.CreateDirectory(uploadRoot);

        var fileName = $"{Guid.NewGuid():N}{extension}";
        var fullPath = Path.Combine(uploadRoot, fileName);
        await using (var stream = System.IO.File.Create(fullPath))
        {
            await file.CopyToAsync(stream);
        }

        expense.ReceiptImagePath = $"/uploads/expenses/{fileName}";
        await _db.SaveChangesAsync();

        return Ok(new { receiptImageUrl = expense.ReceiptImagePath });
    }
}
