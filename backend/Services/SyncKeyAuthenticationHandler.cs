using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;
using System.Text.Encodings.Web;
using Microsoft.AspNetCore.Authentication;
using Microsoft.Extensions.Options;

namespace Tresor.Api.Services;

public sealed class SyncKeyAuthenticationHandler(IOptionsMonitor<AuthenticationSchemeOptions> options,
    ILoggerFactory logger, UrlEncoder encoder, BackOfficeApiOptions syncOptions, InstallationOptions installation)
    : AuthenticationHandler<AuthenticationSchemeOptions>(options, logger, encoder)
{
    public const string SchemeName = "SyncKey";
    protected override Task<AuthenticateResult> HandleAuthenticateAsync()
    {
        if (!installation.IsBackOffice || (!Request.IsHttps && !syncOptions.AllowInsecureHttp))
            return Task.FromResult(AuthenticateResult.Fail("Synchronization transport not enabled."));
        var supplied = Request.Headers["X-Sync-Key"];
        if (supplied.Count != 1 || string.IsNullOrWhiteSpace(syncOptions.SyncKey))
            return Task.FromResult(AuthenticateResult.Fail("Missing synchronization credentials."));
        var actual = SHA256.HashData(Encoding.UTF8.GetBytes(supplied[0]!));
        var expected = SHA256.HashData(Encoding.UTF8.GetBytes(syncOptions.SyncKey));
        if (!CryptographicOperations.FixedTimeEquals(actual, expected))
            return Task.FromResult(AuthenticateResult.Fail("Invalid synchronization credentials."));
        var principal = new ClaimsPrincipal(new ClaimsIdentity([new Claim(ClaimTypes.Name, "CommerceSync")], SchemeName));
        return Task.FromResult(AuthenticateResult.Success(new AuthenticationTicket(principal, SchemeName)));
    }
}
