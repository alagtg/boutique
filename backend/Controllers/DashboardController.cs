using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Tresor.Api.Data;

namespace Tresor.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class DashboardController : ControllerBase
{
    private readonly AppDbContext _db;

    public DashboardController(AppDbContext db)
    {
        _db = db;
    }

    [HttpGet("bi")]
    [Authorize(Roles = "ADMIN")]
    public async Task<IActionResult> BusinessIntelligence([FromQuery] string range = "month", [FromQuery] int? year = null, [FromQuery] int? month = null, [FromQuery] DateTime? date = null)
    {
        var today = DateTime.UtcNow.Date;
        var selectedDate = (date ?? today).Date;
        var selectedYear = year ?? today.Year;
        var selectedMonth = month ?? today.Month;
        var weekStart = selectedDate.AddDays(-(((int)selectedDate.DayOfWeek + 6) % 7));

        var start = range.ToLowerInvariant() switch
        {
            "day" => selectedDate,
            "week" => weekStart,
            "year" => new DateTime(selectedYear, 1, 1),
            "all" => DateTime.MinValue,
            _ => new DateTime(selectedYear, selectedMonth, 1)
        };
        DateTime? end = range.ToLowerInvariant() switch
        {
            "day" => selectedDate.AddDays(1),
            "week" => weekStart.AddDays(7),
            "year" => new DateTime(selectedYear + 1, 1, 1),
            "all" => null,
            _ => new DateTime(selectedYear, selectedMonth, 1).AddMonths(1)
        };

        var sales = await _db.Sales
            .Include(x => x.User)
            .Include(x => x.Payments)
            .Include(x => x.Lines).ThenInclude(x => x.ProductVariant).ThenInclude(x => x.Product)
            .Where(x => x.SaleDate >= start && (end == null || x.SaleDate < end))
            .ToListAsync();
        var expenses = await _db.Expenses
            .Where(x => x.ExpenseDate >= start && (end == null || x.ExpenseDate < end))
            .ToListAsync();

        string BucketLabel(DateTime value) => range.ToLowerInvariant() switch
        {
            "day" => value.ToString("HH:00"),
            "year" => value.ToString("MM/yyyy"),
            "all" => value.ToString("yyyy"),
            _ => value.ToString("dd/MM")
        };

        IEnumerable<DateTime> Buckets()
        {
            if (range.Equals("day", StringComparison.OrdinalIgnoreCase))
                return Enumerable.Range(0, 24).Select(i => start.AddHours(i));
            if (range.Equals("week", StringComparison.OrdinalIgnoreCase))
                return Enumerable.Range(0, 7).Select(i => start.AddDays(i));
            if (range.Equals("month", StringComparison.OrdinalIgnoreCase))
                return Enumerable.Range(0, (end!.Value - start).Days).Select(i => start.AddDays(i));
            if (range.Equals("year", StringComparison.OrdinalIgnoreCase))
                return Enumerable.Range(0, 12).Select(i => start.AddMonths(i));

            var firstYear = sales.Count > 0 ? sales.Min(x => x.SaleDate).Year : today.Year;
            return Enumerable.Range(firstYear, today.Year - firstYear + 1).Select(y => new DateTime(y, 1, 1));
        }

        var timeline = Buckets().Select(bucket =>
        {
            DateTime bucketEnd = range.ToLowerInvariant() switch
            {
                "day" => bucket.AddHours(1),
                "year" => bucket.AddMonths(1),
                "all" => bucket.AddYears(1),
                _ => bucket.AddDays(1)
            };
            var bucketSales = sales.Where(x => x.SaleDate >= bucket && x.SaleDate < bucketEnd).Sum(x => x.TotalAmount);
            var bucketExpenses = expenses.Where(x => x.ExpenseDate >= bucket && x.ExpenseDate < bucketEnd).Sum(x => x.Amount);
            return new { label = BucketLabel(bucket), sales = bucketSales, expenses = bucketExpenses, result = bucketSales - bucketExpenses };
        }).ToList();

        var employeePerformance = sales
            .GroupBy(x => new { x.UserId, x.User.FullName })
            .Select(g => new
            {
                employee = g.Key.FullName,
                salesCount = g.Count(),
                quantity = g.SelectMany(x => x.Lines).Sum(x => x.Quantity),
                revenue = g.Sum(x => x.TotalAmount),
                purchaseCost = g.SelectMany(x => x.Lines).Sum(x => x.ProductVariant.PurchasePrice * x.Quantity),
                profit = g.Sum(x => x.TotalAmount) - g.SelectMany(x => x.Lines).Sum(x => x.ProductVariant.PurchasePrice * x.Quantity)
            })
            .OrderByDescending(x => x.revenue)
            .ToList();

        var topProducts = sales.SelectMany(x => x.Lines)
            .GroupBy(x => x.ProductVariant.Product.ProductName)
            .Select(g => new { productName = g.Key, quantity = g.Sum(x => x.Quantity), revenue = g.Sum(x => x.LineTotal) })
            .OrderByDescending(x => x.revenue).Take(8).ToList();
        var paymentMethods = sales.SelectMany(x => x.Payments)
            .GroupBy(x => x.PaymentMethod)
            .Select(g => new { method = g.Key, amount = g.Sum(x => x.Amount) })
            .OrderByDescending(x => x.amount).ToList();

        var revenue = sales.Sum(x => x.TotalAmount);
        var expenseTotal = expenses.Sum(x => x.Amount);
        var purchaseCost = sales.SelectMany(x => x.Lines).Sum(x => x.ProductVariant.PurchasePrice * x.Quantity);
        return Ok(new
        {
            range,
            start,
            end,
            metrics = new
            {
                revenue,
                expenseTotal,
                purchaseCost,
                grossProfit = revenue - purchaseCost,
                netResult = revenue - purchaseCost - expenseTotal,
                salesCount = sales.Count,
                quantity = sales.SelectMany(x => x.Lines).Sum(x => x.Quantity),
                averageBasket = sales.Count == 0 ? 0 : revenue / sales.Count,
                totalCustomers = await _db.Customers.CountAsync(),
                vipCustomers = await _db.Customers.CountAsync(x => x.VipStatus),
                lowStock = await _db.ProductVariants.CountAsync(x => x.CurrentStock <= x.MinStock),
                lateReservations = await _db.Reservations.CountAsync(x => x.Status == "RESERVED" && x.DueDate <= today)
            },
            timeline,
            employeePerformance,
            topProducts,
            paymentMethods
        });
    }

    [HttpGet("summary")]
    public async Task<IActionResult> Summary([FromQuery] string range = "month", [FromQuery] int? year = null, [FromQuery] int? month = null, [FromQuery] DateTime? date = null)
    {
        var today = DateTime.UtcNow.Date;
        var selectedDate = (date ?? today).Date;
        var startOfWeek = today.AddDays(-(((int)today.DayOfWeek + 6) % 7));
        var selectedStartOfWeek = selectedDate.AddDays(-(((int)selectedDate.DayOfWeek + 6) % 7));
        var startOfMonth = new DateTime(today.Year, today.Month, 1);
        var startOfYear = new DateTime(year ?? today.Year, 1, 1);
        var selectedMonth = month.HasValue ? new DateTime(year ?? today.Year, month.Value, 1) : startOfMonth;

        DateTime selectedStart = range.ToLowerInvariant() switch
        {
            "day" => selectedDate,
            "week" => selectedStartOfWeek,
            "year" => startOfYear,
            "all" => DateTime.MinValue,
            _ => selectedMonth
        };

        DateTime? selectedEnd = range.ToLowerInvariant() switch
        {
            "day" => selectedDate.AddDays(1),
            "week" => selectedStartOfWeek.AddDays(7),
            "year" => startOfYear.AddYears(1),
            "all" => null,
            _ => selectedMonth.AddMonths(1)
        };

        var salesToday = (await _db.Sales
            .Where(x => x.SaleDate >= today)
            .Select(x => x.TotalAmount)
            .ToListAsync())
            .Sum();

        var salesMonth = (await _db.Sales
            .Where(x => x.SaleDate >= startOfMonth)
            .Select(x => x.TotalAmount)
            .ToListAsync())
            .Sum();

        var salesWeek = (await _db.Sales
            .Where(x => x.SaleDate >= startOfWeek)
            .Select(x => x.TotalAmount)
            .ToListAsync())
            .Sum();

        var salesYear = (await _db.Sales
            .Where(x => x.SaleDate >= new DateTime(today.Year, 1, 1))
            .Select(x => x.TotalAmount)
            .ToListAsync())
            .Sum();

        var saleLinesForQuickPeriods = await _db.SaleLines
            .Include(x => x.Sale)
            .Include(x => x.ProductVariant)
            .Where(x => x.Sale.SaleDate >= startOfYear)
            .Select(x => new
            {
                x.Sale.SaleDate,
                x.Quantity,
                x.LineTotal,
                x.ProductVariant.PurchasePrice
            })
            .ToListAsync();

        object BuildProfit(DateTime start)
        {
            var lines = saleLinesForQuickPeriods.Where(x => x.SaleDate >= start).ToList();
            var salesTotal = lines.Sum(x => x.LineTotal);
            var purchaseTotal = lines.Sum(x => x.PurchasePrice * x.Quantity);
            return new
            {
                salesTotal,
                purchaseTotal,
                profit = salesTotal - purchaseTotal
            };
        }

        var productProfitToday = BuildProfit(today);
        var productProfitWeek = BuildProfit(startOfWeek);
        var productProfitSalesMonth = BuildProfit(startOfMonth);

        var periodSaleLines = await _db.SaleLines
            .Include(x => x.Sale).ThenInclude(x => x.User)
            .Include(x => x.ProductVariant).ThenInclude(x => x.Product)
            .Where(x => x.Sale.SaleDate >= selectedStart && (selectedEnd == null || x.Sale.SaleDate < selectedEnd))
            .Select(x => new
            {
                employee = x.Sale.User.FullName,
                x.Sale.UserId,
                productName = x.ProductVariant.Product.ProductName,
                x.Quantity,
                x.LineTotal,
                x.ProductVariant.PurchasePrice
            })
            .ToListAsync();

        var periodSalesTotal = periodSaleLines.Sum(x => x.LineTotal);
        var periodPurchaseTotal = periodSaleLines.Sum(x => x.PurchasePrice * x.Quantity);
        var employeePerformance = periodSaleLines
            .GroupBy(x => new { x.UserId, x.employee })
            .Select(g => new
            {
                employee = g.Key.employee,
                quantity = g.Sum(x => x.Quantity),
                salesTotal = g.Sum(x => x.LineTotal),
                purchaseTotal = g.Sum(x => x.PurchasePrice * x.Quantity),
                profit = g.Sum(x => x.LineTotal - (x.PurchasePrice * x.Quantity)),
                products = g.GroupBy(x => x.productName)
                    .Select(p => new
                    {
                        productName = p.Key,
                        quantity = p.Sum(x => x.Quantity),
                        salesTotal = p.Sum(x => x.LineTotal)
                    })
                    .OrderByDescending(x => x.quantity)
                    .Take(6)
                    .ToList()
            })
            .OrderByDescending(x => x.salesTotal)
            .ToList();

        async Task<decimal> SumExpenses(DateTime start, DateTime? end = null)
        {
            return (await _db.Expenses
                .Where(x => x.ExpenseDate >= start && (end == null || x.ExpenseDate < end))
                .Select(x => x.Amount)
                .ToListAsync())
                .Sum();
        }

        var expensesToday = await SumExpenses(today, today.AddDays(1));
        var expensesWeek = await SumExpenses(startOfWeek, startOfWeek.AddDays(7));
        var expensesMonth = await SumExpenses(startOfMonth, startOfMonth.AddMonths(1));
        var expensesYear = await SumExpenses(new DateTime(today.Year, 1, 1), new DateTime(today.Year + 1, 1, 1));
        var selectedExpensesTotal = await SumExpenses(selectedStart, selectedEnd);

        var productMargins = await _db.ProductVariants
            .Include(x => x.Product)
            .Select(x => new
            {
                productName = x.Product.ProductName,
                x.CurrentStock,
                x.PurchasePrice,
                x.SalePrice
            })
            .ToListAsync();

        var productProfitMonth = productMargins
            .Sum(x => Math.Max(0, x.SalePrice - x.PurchasePrice) * Math.Max(0, x.CurrentStock));
        var stockPurchaseValue = productMargins
            .Sum(x => x.PurchasePrice * Math.Max(0, x.CurrentStock));
        var stockSaleValue = productMargins
            .Sum(x => x.SalePrice * Math.Max(0, x.CurrentStock));

        var topProductProfits = productMargins
            .GroupBy(x => x.productName)
            .Select(g => new
            {
                productName = g.Key,
                quantity = g.Sum(x => x.CurrentStock),
                salesTotal = g.Sum(x => x.SalePrice * Math.Max(0, x.CurrentStock)),
                profit = g.Sum(x => Math.Max(0, x.SalePrice - x.PurchasePrice) * Math.Max(0, x.CurrentStock))
            })
            .OrderByDescending(x => x.profit)
            .Take(5)
            .ToList();

        var lowStockItems = await _db.ProductVariants
            .Include(x => x.Product)
            .Where(x => x.CurrentStock <= x.MinStock)
            .OrderBy(x => x.CurrentStock)
            .Take(5)
            .Select(x => new
            {
                productName = x.Product.ProductName,
                x.Barcode,
                x.CurrentStock,
                x.MinStock
            })
            .ToListAsync();

        var topCustomers = await _db.Customers
            .OrderByDescending(x => (double)x.TotalSpentCurrentMonth)
            .Take(5)
            .Select(x => new
            {
                name = x.FirstName + " " + x.LastName,
                x.TotalSpentCurrentMonth
            })
            .ToListAsync();

        return Ok(new
        {
            salesToday,
            salesWeek,
            salesMonth,
            salesYear,
            expensesToday,
            expensesWeek,
            expensesMonth,
            expensesYear,
            netToday = salesToday - expensesToday,
            netWeek = salesWeek - expensesWeek,
            profitMonth = salesMonth - expensesMonth,
            netYear = salesYear - expensesYear,
            productProfitToday,
            productProfitWeek,
            productProfitSalesMonth,
            selectedPeriod = new
            {
                range,
                start = selectedStart,
                end = selectedEnd,
                salesTotal = periodSalesTotal,
                purchaseTotal = periodPurchaseTotal,
                expensesTotal = selectedExpensesTotal,
                profit = periodSalesTotal - periodPurchaseTotal,
                resultAfterExpenses = periodSalesTotal - selectedExpensesTotal,
                quantity = periodSaleLines.Sum(x => x.Quantity)
            },
            employeePerformance,
            productProfitMonth,
            stockPurchaseValue,
            stockSaleValue,
            stockPotentialProfit = stockSaleValue - stockPurchaseValue,
            totalCustomers = await _db.Customers.CountAsync(),
            vipCustomers = await _db.Customers.CountAsync(x => x.VipStatus),
            lowStock = await _db.ProductVariants.CountAsync(x => x.CurrentStock <= x.MinStock),
            reservationsLate = await _db.Reservations.CountAsync(x => x.Status == "RESERVED" && x.DueDate <= today),
            creditAlerts = await _db.Customers.CountAsync(x => x.CurrentCreditAmount > 300),
            lowStockItems,
            topProductProfits,
            topCustomers
        });
    }
}
