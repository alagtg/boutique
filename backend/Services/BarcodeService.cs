namespace Tresor.Api.Services;

public class BarcodeService
{
    public string Generate()
    {
        return "20" + System.Security.Cryptography.RandomNumberGenerator.GetInt32(100000).ToString("D5")
            + System.Security.Cryptography.RandomNumberGenerator.GetInt32(100000).ToString("D5");
    }

    public static bool IsPrintable(string value) => value.Length is >= 1 and <= 40 &&
        value.All(c => c is >= '!' and <= '~');

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
