using Microsoft.EntityFrameworkCore;
using Tresor.Api.Data;
using Tresor.Api.Models;

namespace Tresor.Api.Services;

public sealed class CustomerSaleEffects(AppDbContext db)
{
    public async Task ApplyAsync(Sale sale, CancellationToken ct = default)
    {
        var customer = sale.Customer;
        if (customer == null && sale.CustomerId is int id)
            customer = await db.Customers.Include(x => x.LoyaltyAccount).SingleAsync(x => x.Id == id, ct);
        if (customer == null) return;
        customer.TotalSpentLifetime += sale.TotalAmount;
        // Late delivery of an offline sale must not inflate this month's loyalty balance.
        var now = DateTime.UtcNow;
        if (sale.SaleDate.Year == now.Year && sale.SaleDate.Month == now.Month)
            customer.TotalSpentCurrentMonth += sale.TotalAmount;
        customer.VipStatus = customer.TotalSpentLifetime >= 1000 || customer.TotalSpentCurrentMonth >= 500;
        var loyalty = customer.LoyaltyAccount;
        if (loyalty == null && customer.Id != 0)
            loyalty = await db.LoyaltyAccounts.SingleOrDefaultAsync(x => x.CustomerId == customer.Id, ct);
        if (loyalty != null)
        {
            loyalty.PointsBalance += (int)Math.Floor(sale.TotalAmount / 10);
            loyalty.TierLevel = customer.VipStatus ? "VIP" : "STANDARD";
        }
        if (customer.TotalSpentCurrentMonth > 300 && !await db.Vouchers.AnyAsync(v =>
            v.CustomerId == customer.Id && v.Code.StartsWith("ROUE-") &&
            v.CreatedAt.Year == now.Year && v.CreatedAt.Month == now.Month, ct))
        {
            db.Vouchers.Add(new Voucher
            {
                Customer = customer, Code = $"ROUE-{customer.QrCodeToken}-{now:yyyyMM}",
                VoucherType = "WHEEL", Value = 0, Status = "ACTIVE"
            });
        }
    }
}
