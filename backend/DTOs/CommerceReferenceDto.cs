using Tresor.Api.Models;

namespace Tresor.Api.DTOs;

// Transport for the explicit, one-time provisioning command. No sales, expenses or audit history.
public sealed class CommerceReferenceDto
{
    public List<Role> Roles { get; set; } = [];
    public List<User> Users { get; set; } = [];
    public List<StoreSetting> Settings { get; set; } = [];
    public List<Category> Categories { get; set; } = [];
    public List<Brand> Brands { get; set; } = [];
    public List<Product> Products { get; set; } = [];
    public List<ProductVariant> Variants { get; set; } = [];
    public List<ProductImage> Images { get; set; } = [];
    public List<Customer> Customers { get; set; } = [];
    public List<LoyaltyAccount> Loyalty { get; set; } = [];
    public List<Voucher> Vouchers { get; set; } = [];
}
