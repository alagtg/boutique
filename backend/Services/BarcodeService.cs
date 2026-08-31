namespace Tresor.Api.Services;

public class BarcodeService
{
    public string Generate(string prefix = "TN")
    {
        var number = DateTime.UtcNow.Ticks.ToString()[^10..];
        return $"{prefix}{number}";
    }

    public string GenerateSku(string productName)
    {
        var clean = new string(productName
            .ToUpperInvariant()
            .Where(char.IsLetterOrDigit)
            .Take(6)
            .ToArray());

        if (string.IsNullOrWhiteSpace(clean))
            clean = "ITEM";

        return $"{clean}-{Random.Shared.Next(1000, 9999)}";
    }
}
