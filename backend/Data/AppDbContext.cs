using Microsoft.EntityFrameworkCore;
using Tresor.Api.Models;

namespace Tresor.Api.Data;

public class AppDbContext : DbContext
{
    public AppDbContext(DbContextOptions<AppDbContext> options) : base(options) { }

    public DbSet<Role> Roles => Set<Role>();
    public DbSet<Permission> Permissions => Set<Permission>();
    public DbSet<RolePermission> RolePermissions => Set<RolePermission>();
    public DbSet<User> Users => Set<User>();
    public DbSet<UserSession> UserSessions => Set<UserSession>();

    public DbSet<StoreSetting> StoreSettings => Set<StoreSetting>();
    public DbSet<Category> Categories => Set<Category>();
    public DbSet<Brand> Brands => Set<Brand>();
    public DbSet<Product> Products => Set<Product>();
    public DbSet<ProductVariant> ProductVariants => Set<ProductVariant>();
    public DbSet<ProductImage> ProductImages => Set<ProductImage>();
    public DbSet<StockPurchase> StockPurchases => Set<StockPurchase>();

    public DbSet<Customer> Customers => Set<Customer>();
    public DbSet<LoyaltyAccount> LoyaltyAccounts => Set<LoyaltyAccount>();
    public DbSet<Voucher> Vouchers => Set<Voucher>();

    public DbSet<Register> Registers => Set<Register>();
    public DbSet<CashSession> CashSessions => Set<CashSession>();
    public DbSet<Sale> Sales => Set<Sale>();
    public DbSet<SaleLine> SaleLines => Set<SaleLine>();
    public DbSet<SalePayment> SalePayments => Set<SalePayment>();

    public DbSet<Reservation> Reservations => Set<Reservation>();
    public DbSet<ReservationItem> ReservationItems => Set<ReservationItem>();

    public DbSet<ExpenseCategory> ExpenseCategories => Set<ExpenseCategory>();
    public DbSet<Expense> Expenses => Set<Expense>();

    public DbSet<AuditLog> AuditLogs => Set<AuditLog>();
    public DbSet<Notification> Notifications => Set<Notification>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);

        modelBuilder.Entity<Role>().HasIndex(x => x.Name).IsUnique();
        modelBuilder.Entity<Permission>().HasIndex(x => x.Code).IsUnique();
        modelBuilder.Entity<User>().HasIndex(x => x.Username).IsUnique();
        modelBuilder.Entity<Customer>().HasIndex(x => x.Phone);
        modelBuilder.Entity<ProductVariant>().HasIndex(x => x.Barcode).IsUnique();
        modelBuilder.Entity<Sale>().HasIndex(x => x.SaleNumber).IsUnique();
        modelBuilder.Entity<Reservation>().HasIndex(x => x.ReservationNumber).IsUnique();
        modelBuilder.Entity<Voucher>().HasIndex(x => x.Code).IsUnique();

        modelBuilder.Entity<ProductVariant>().Property(x => x.PurchasePrice).HasColumnType("decimal(18,2)");
        modelBuilder.Entity<ProductVariant>().Property(x => x.SalePrice).HasColumnType("decimal(18,2)");
        modelBuilder.Entity<StockPurchase>().Property(x => x.UnitPurchasePrice).HasColumnType("decimal(18,2)");
        modelBuilder.Entity<Customer>().Property(x => x.TotalSpentLifetime).HasColumnType("decimal(18,2)");
        modelBuilder.Entity<Customer>().Property(x => x.TotalSpentCurrentMonth).HasColumnType("decimal(18,2)");
        modelBuilder.Entity<Customer>().Property(x => x.CurrentCreditAmount).HasColumnType("decimal(18,2)");
        modelBuilder.Entity<Voucher>().Property(x => x.Value).HasColumnType("decimal(18,2)");
        modelBuilder.Entity<Voucher>().Property(x => x.MinPurchaseAmount).HasColumnType("decimal(18,2)");
        modelBuilder.Entity<Sale>().Property(x => x.SubtotalAmount).HasColumnType("decimal(18,2)");
        modelBuilder.Entity<Sale>().Property(x => x.DiscountAmount).HasColumnType("decimal(18,2)");
        modelBuilder.Entity<Sale>().Property(x => x.TotalAmount).HasColumnType("decimal(18,2)");
        modelBuilder.Entity<Sale>().Property(x => x.PaidAmount).HasColumnType("decimal(18,2)");
        modelBuilder.Entity<Sale>().Property(x => x.RemainingAmount).HasColumnType("decimal(18,2)");
        modelBuilder.Entity<SaleLine>().Property(x => x.UnitPrice).HasColumnType("decimal(18,2)");
        modelBuilder.Entity<SaleLine>().Property(x => x.DiscountAmount).HasColumnType("decimal(18,2)");
        modelBuilder.Entity<SaleLine>().Property(x => x.LineTotal).HasColumnType("decimal(18,2)");
        modelBuilder.Entity<SalePayment>().Property(x => x.Amount).HasColumnType("decimal(18,2)");
        modelBuilder.Entity<CashSession>().Property(x => x.OpeningAmount).HasColumnType("decimal(18,2)");
        modelBuilder.Entity<CashSession>().Property(x => x.CountedCashAmount).HasColumnType("decimal(18,2)");
        modelBuilder.Entity<CashSession>().Property(x => x.DifferenceAmount).HasColumnType("decimal(18,2)");
        modelBuilder.Entity<Reservation>().Property(x => x.DepositAmount).HasColumnType("decimal(18,2)");
        modelBuilder.Entity<Reservation>().Property(x => x.TotalAmount).HasColumnType("decimal(18,2)");
        modelBuilder.Entity<Reservation>().Property(x => x.RemainingAmount).HasColumnType("decimal(18,2)");
        modelBuilder.Entity<ReservationItem>().Property(x => x.UnitPrice).HasColumnType("decimal(18,2)");
        modelBuilder.Entity<ReservationItem>().Property(x => x.LineTotal).HasColumnType("decimal(18,2)");
        modelBuilder.Entity<StoreSetting>().Property(x => x.WheelEligibilityAmount).HasColumnType("decimal(18,2)");
        modelBuilder.Entity<StoreSetting>().Property(x => x.EmployeeMaxDiscountPercent).HasColumnType("decimal(18,2)");
        modelBuilder.Entity<Expense>().Property(x => x.Amount).HasColumnType("decimal(18,2)");
    }
}
