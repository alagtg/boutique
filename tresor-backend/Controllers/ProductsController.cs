
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
    public class ProductsController : ControllerBase
    {
        private readonly AppDbContext _db; private readonly IWebHostEnvironment _env;
        public ProductsController(AppDbContext db, IWebHostEnvironment env) { _db = db; _env = env; }

        [HttpGet]
        public async Task<ActionResult<IEnumerable<Product>>> GetAll([FromQuery] bool? published = null)
        {
            var q = _db.Products.AsQueryable();
            if (published.HasValue) q = q.Where(p => p.IsPublished == published.Value);
            return await q.OrderByDescending(p => p.CreatedAt).ToListAsync();
        }

        [HttpGet("{id:int}")]
        public async Task<ActionResult<Product>> Get(int id) => await _db.Products.FindAsync(id) is { } p ? Ok(p) : NotFound();

        [HttpPost]
        [Authorize(Roles = "Admin")]
        public async Task<ActionResult<Product>> Create(ProductCreateDto dto)
        {
            var p = new Product{ Name=dto.Name, Description=dto.Description, Category=dto.Category, Price=dto.Price, Stock=dto.Stock, IsPublished=dto.IsPublished, ImageUrl=dto.ImageUrl };
            _db.Products.Add(p); await _db.SaveChangesAsync();
            return CreatedAtAction(nameof(Get), new { id = p.Id }, p);
        }

        [HttpPut("{id:int}")]
        [Authorize(Roles = "Admin")]
        public async Task<IActionResult> Update(int id, ProductCreateDto dto)
        {
            var p = await _db.Products.FindAsync(id); if (p is null) return NotFound();
            p.Name=dto.Name; p.Description=dto.Description; p.Category=dto.Category; p.Price=dto.Price; p.Stock=dto.Stock; p.IsPublished=dto.IsPublished; p.ImageUrl=dto.ImageUrl; p.UpdatedAt=DateTime.UtcNow;
            await _db.SaveChangesAsync(); return NoContent();
        }

        [HttpDelete("{id:int}")]
        [Authorize(Roles = "Admin")]
        public async Task<IActionResult> Delete(int id)
        {
            var p = await _db.Products.FindAsync(id); if (p is null) return NotFound();
            _db.Products.Remove(p); await _db.SaveChangesAsync(); return NoContent();
        }

        [HttpPost("upload")]
        [Authorize(Roles = "Admin")]
        public async Task<ActionResult<object>> Upload(IFormFile file)
        {
            if (file is null || file.Length == 0) return BadRequest("Fichier vide");
            var folder = Path.Combine(_env.WebRootPath ?? "wwwroot", "uploads");
            Directory.CreateDirectory(folder);
            var fileName = $"{Guid.NewGuid()}_{file.FileName}".Replace(" ", "_");
            var full = Path.Combine(folder, fileName);
            using var stream = System.IO.File.Create(full);
            await file.CopyToAsync(stream);
            var url = $"/uploads/{fileName}";
            return Ok(new { url });
        }
    }
}
