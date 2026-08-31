namespace Tresor.Api.Models;

public class StoreSetting : BaseEntity
{
    public string StoreName { get; set; } = "Trésor Boutique";
    public string? LogoPath { get; set; }
    public string PrimaryColor { get; set; } = "#C9A13B";
    public string SecondaryColor { get; set; } = "#9A7420";
    public string BackgroundColor { get; set; } = "#FFFDF8";
    public string TextColor { get; set; } = "#1A1A1A";
    public string CurrencyCode { get; set; } = "TND";
    public string? Phone { get; set; }
    public string? WhatsAppNumber { get; set; }
    public string? Address { get; set; }
    public string? ReceiptFooterMessage { get; set; }
    public decimal WheelEligibilityAmount { get; set; } = 300m;
    public string WheelPrizes { get; set; } = "Cadeau boutique|Reduction 10%|Bon achat 20 DT|Surprise prochaine visite";
    public string MonthlyGiftPrize { get; set; } = "Cadeau mensuel Tresor Boutique";
    public string MonthlyGiftReminderMessage { get; set; } = "Rappel fin de mois: faites le tirage cadeau parmi tous les clients qui ont achete ce mois.";
    public int ReservationReminderDaysDefault { get; set; } = 20;
    public decimal EmployeeMaxDiscountPercent { get; set; } = 10m;
}
