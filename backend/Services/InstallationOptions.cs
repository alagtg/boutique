namespace Tresor.Api.Services;

public sealed class InstallationOptions
{
    public string Mode { get; set; } = "Standalone";
    public string NodeId { get; set; } = "";
    public bool IsCommerce => Mode == "Commerce";
    public bool IsBackOffice => Mode == "BackOffice";
}

public sealed class BackOfficeApiOptions
{
    public string BaseUrl { get; set; } = "";
    public string SyncKey { get; set; } = "";
    public int TimeoutSeconds { get; set; } = 5;
    public int IntervalSeconds { get; set; } = 30;
    public int BatchSize { get; set; } = 50;
    public bool AllowInsecureHttp { get; set; }
}
