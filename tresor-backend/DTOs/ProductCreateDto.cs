namespace Tresor.Api.DTOs
{
    public class ProductCreateDto
    {
        public string Name { get; set; } = string.Empty;
        public string Description { get; set; } = string.Empty;
        public decimal Price { get; set; }
        public int Stock { get; set; }
        public string Category { get; set; } = "Général";
        public string? ImageUrl { get; set; }
        public bool IsPublished { get; set; } = true;
    }
}
