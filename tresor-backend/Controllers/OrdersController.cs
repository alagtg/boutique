// Controllers/OrdersController.cs
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Tresor.Api.Data;
using Tresor.Api.DTOs;
using Tresor.Api.Models;

namespace Tresor.Api.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class OrdersController : ControllerBase
    {
        private readonly AppDbContext _db;
        public OrdersController(AppDbContext db) => _db = db;

        [HttpGet]
        public async Task<ActionResult<IEnumerable<Order>>> GetAll()
        {
            var orders = await _db.Orders
                .Include(o => o.Items).ThenInclude(i => i.Product)
                .OrderByDescending(o => o.CreatedAt)
                .ToListAsync();
            return Ok(orders);
        }

        [HttpGet("{id:int}")]
        public async Task<ActionResult<Order>> GetById(int id)
        {
            var o = await _db.Orders
                .Include(x => x.Items).ThenInclude(i => i.Product)
                .FirstOrDefaultAsync(x => x.Id == id);
            if (o == null) return NotFound();
            return Ok(o);
        }

        [HttpPost]
        public async Task<ActionResult<object>> Create(CreateOrderDto dto)
        {
            if (dto.Items.Count == 0) return BadRequest("Aucun article");
            var order = new Order
            {
                CustomerName = dto.CustomerName,
                Phone = dto.Phone,
                Address = dto.Address,
                Note = dto.Note
            };

            foreach (var it in dto.Items)
            {
                var product = await _db.Products.FindAsync(it.ProductId);
                if (product == null) return BadRequest($"Produit {it.ProductId} introuvable");
                if (product.Stock < it.Quantity) return BadRequest($"Stock insuffisant pour {product.Name}");
                product.Stock -= it.Quantity;
                order.Items.Add(new OrderItem
                {
                    ProductId = it.ProductId,
                    Size = it.Size,
                    Color = it.Color,
                    Quantity = it.Quantity,
                    UnitPrice = it.UnitPrice
                });
            }

            _db.Orders.Add(order);
            await _db.SaveChangesAsync();
            return Ok(new { message = "Commande créée", orderId = order.Id, total = order.Total });
        }

        // --- MAJ statut d'appel (Answered / NoAnswer / None) ---
        [HttpPatch("{id:int}/call")]
        public async Task<ActionResult> UpdateCall(int id, [FromBody] UpdateCallStatusDto dto)
        {
            var o = await _db.Orders.FindAsync(id);
            if (o == null) return NotFound();

            o.CallStatus = dto.Status.ToLowerInvariant() switch
            {
                "answered" => CallStatus.Answered,
                "noanswer" => CallStatus.NoAnswer,
                _ => CallStatus.None
            };
            o.CalledAt = o.CallStatus == CallStatus.None ? null : DateTime.UtcNow;

            await _db.SaveChangesAsync();
            return NoContent();
        }

        // --- MAJ statut de commande (optionnel mais utile) ---
        [HttpPatch("{id:int}/status")]
        public async Task<ActionResult> UpdateStatus(int id, [FromBody] UpdateOrderStatusDto dto)
        {
            var o = await _db.Orders.FindAsync(id);
            if (o == null) return NotFound();

            o.Status = dto.Status.ToLowerInvariant() switch
            {
                "confirmed" => OrderStatus.Confirmed,
                "shipped" => OrderStatus.Shipped,
                "delivered" => OrderStatus.Delivered,
                "canceled" => OrderStatus.Canceled,
                _ => OrderStatus.Pending
            };

            await _db.SaveChangesAsync();
            return NoContent();
        }

        // --- DELETE 1 commande + restock ---
        [HttpDelete("{id:int}")]
        public async Task<ActionResult> Delete(int id)
        {
            await using var tx = await _db.Database.BeginTransactionAsync();
            var o = await _db.Orders.Include(x => x.Items).FirstOrDefaultAsync(x => x.Id == id);
            if (o == null) return NotFound();

            foreach (var it in o.Items)
            {
                var p = await _db.Products.FindAsync(it.ProductId);
                if (p != null) p.Stock += it.Quantity; // restock
            }

            _db.OrderItems.RemoveRange(o.Items);
            _db.Orders.Remove(o);
            await _db.SaveChangesAsync();
            await tx.CommitAsync();
            return NoContent();
        }

        // --- RESET du jour (YYYY-MM-DD) + restock ---
        [HttpDelete("bulk")]
        public async Task<ActionResult<object>> BulkDelete([FromQuery] DateOnly date)
        {
            var start = date.ToDateTime(TimeOnly.MinValue, DateTimeKind.Utc);
            var end = date.ToDateTime(TimeOnly.MaxValue, DateTimeKind.Utc);

            await using var tx = await _db.Database.BeginTransactionAsync();

            var orders = await _db.Orders
                .Include(o => o.Items)
                .Where(o => o.CreatedAt >= start && o.CreatedAt <= end)
                .ToListAsync();

            foreach (var o in orders)
            {
                foreach (var it in o.Items)
                {
                    var p = await _db.Products.FindAsync(it.ProductId);
                    if (p != null) p.Stock += it.Quantity; // restock
                }
            }

            var allItems = orders.SelectMany(o => o.Items).ToList();
            _db.OrderItems.RemoveRange(allItems);
            _db.Orders.RemoveRange(orders);
            var count = await _db.SaveChangesAsync();
            await tx.CommitAsync();

            return Ok(new { removedOrders = orders.Count, restoredItems = allItems.Count });
        }
    }
}
