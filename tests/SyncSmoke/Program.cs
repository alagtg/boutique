using System.Diagnostics;
using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Net.Sockets;
using System.Security.Cryptography;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Tresor.Api.Data;
using Tresor.Api.DTOs;
using Tresor.Api.Models;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging.Abstractions;

var root = Path.GetFullPath(args.Length > 0 ? args[0] : ".");
var backend = Path.Combine(root, "backend");
var apiDll = Path.Combine(backend, "bin", "Sync", "net8.0", "Tresor.Api.dll");
var packagedExecutable = Environment.GetEnvironmentVariable("SYNC_TEST_API_EXECUTABLE");
var testId = DateTime.UtcNow.ToString("yyyyMMddHHmmss") + "_" + Guid.NewGuid().ToString("N")[..6];
var server = Environment.GetEnvironmentVariable("SYNC_TEST_SQL_SERVER") ?? "localhost";
var backConnection = $"Server={server};Database=TresorSyncTest_Back_{testId};Integrated Security=True;TrustServerCertificate=True";
var commerceConnection = $"Server={server};Database=TresorSyncTest_Commerce_{testId};Integrated Security=True;TrustServerCertificate=True";
Console.WriteLine($"SQL Server test databases: TresorSyncTest_Back_{testId}, TresorSyncTest_Commerce_{testId}");
var key = Convert.ToHexString(RandomNumberGenerator.GetBytes(32));
var password = Convert.ToHexString(RandomNumberGenerator.GetBytes(20));
var backPort = FreePort();
var commercePort = FreePort();
while (commercePort == backPort) commercePort = FreePort();
var backUrl = $"http://localhost:{backPort}";
var commerceUrl = $"http://localhost:{commercePort}";
using var http = new HttpClient { Timeout = TimeSpan.FromSeconds(10) };
Process? back = null;
Process? commerce = null;
var logs = new System.Collections.Concurrent.ConcurrentQueue<string>();
try
{
    await TestAdoption();
    await using (var db = Back())
    {
        await db.Database.MigrateAsync();
        var admin = new Role { Name = "ADMIN" };
        var employee = new Role { Name = "EMPLOYE" };
        db.Users.Add(new User { Username = "admin-test", FullName = "Test admin", Role = admin, PasswordHash = BCrypt.Net.BCrypt.HashPassword(password) });
        db.Users.Add(new User { Username = "seller-test", FullName = "Test seller", Role = employee, PasswordHash = BCrypt.Net.BCrypt.HashPassword(password) });
        var product = new Product { ProductName = "Test product", Reference = "REF-SYNC", Category = new Category { Name = "Test" } };
        product.Variants.Add(new ProductVariant { Barcode = "SYNC-BARCODE", SKU = "SYNC-SKU", SalePrice = 25, PurchasePrice = 5, CurrentStock = 100 });
        db.Products.Add(product);
        db.Customers.Add(new Customer { FirstName = "Test", LastName = "Customer", Phone = "TEST-PHONE", QrCodeToken = Guid.NewGuid().ToString("N"), LoyaltyAccount = new LoyaltyAccount() });
        db.StoreSettings.Add(new StoreSetting { StoreName = "Sync test" });
        await db.SaveChangesAsync();
    }
    using (var migrate = Start("Commerce", commercePort, "--migrate-commerce"))
    {
        await migrate.WaitForExitAsync().WaitAsync(TimeSpan.FromSeconds(45));
        Check(migrate.ExitCode == 0, "Commerce migration command without EF CLI");
    }
    await using (var db = Commerce())
    {
        await db.Database.MigrateAsync();
        // Force different numeric IDs in the two databases.
        await db.Database.ExecuteSqlRawAsync("DBCC CHECKIDENT ('Users', RESEED, 100); DBCC CHECKIDENT ('ProductVariants', RESEED, 200); DBCC CHECKIDENT ('Customers', RESEED, 300);");
    }
    back = Start("BackOffice", backPort);
    await Ready(backUrl);
    using (var provisioning = Start("Commerce", commercePort, "--provision-commerce"))
    {
        await provisioning.WaitForExitAsync().WaitAsync(TimeSpan.FromSeconds(30));
        Check(provisioning.ExitCode == 0, "Commerce provisioning");
    }
    await using (var db = Commerce())
    {
        Check(await db.Sales.CountAsync() == 0 && await db.Expenses.CountAsync() == 0, "No history copied to Commerce");
        Check((await db.Users.FirstAsync()).Id >= 100, "Different IDs provisioned");
        var user = await db.Users.SingleAsync(x => x.Username == "seller-test");
        var register = await db.Registers.SingleAsync();
        db.CashSessions.Add(new CashSession { Register = register, OpenedByUser = user, OpeningAmount = 50 });
        await db.SaveChangesAsync();
    }
    commerce = Start("Commerce", commercePort);
    await Ready(commerceUrl);
    var sellerToken = await Login(commerceUrl, "seller-test");
    if (packagedExecutable != null)
    {
        var page = await http.GetStringAsync(commerceUrl + "/employee/pos");
        var configScript = await http.GetStringAsync(commerceUrl + "/assets/runtime-config.js");
        var mainScript = await http.GetStringAsync(commerceUrl + "/main.js");
        Check(page.Contains("<app-root>") && configScript.Contains("location.origin") && mainScript.Length > 10000,
            "Packaged Angular routes, JavaScript and same-origin API configuration");
    }
    var adminToken = await Login(commerceUrl, "admin-test");

    var first = await CreateSale(sellerToken);
    await Synced(first);
    Check(true, "1. Online sale delivered");
    string payload;
    await using (var db = Commerce()) payload = (await db.Sales.SingleAsync(x => x.SyncId == first)).SyncPayload!;
    for (var i = 0; i < 2; i++)
    {
        using var request = new HttpRequestMessage(HttpMethod.Post, backUrl + "/api/sync/sales");
        request.Headers.Add("X-Sync-Key", key);
        request.Content = new StringContent(payload, System.Text.Encoding.UTF8, "application/json");
        using var response = await http.SendAsync(request);
        Check(response.IsSuccessStatusCode && (await response.Content.ReadFromJsonAsync<SaleSyncReceipt>())!.AlreadyExists, "4. Duplicate accepted without reinserting");
    }
    await Stop(back); back = null;
    var offline1 = await CreateSale(sellerToken);
    var offline2 = await CreateSale(sellerToken);
    await Task.Delay(1500);
    await using (var db = Commerce())
        Check(await db.Sales.CountAsync(x => !x.IsSynced) == 2 && await db.Sales.AnyAsync(x => x.SyncAttempts > 0 && x.LastSyncError != null), "2. Offline sales retained with retry details");
    await Stop(commerce); commerce = null;
    commerce = Start("Commerce", commercePort);
    await Ready(commerceUrl);
    await using (var db = Commerce()) Check(await db.Sales.CountAsync(x => !x.IsSynced) == 2, "6. Pending sales survive restart");
    back = Start("BackOffice", backPort);
    await Ready(backUrl);
    await Synced(offline1); await Synced(offline2);
    Check(true, "3. Automatic recovery after BackOffice restart");

    // A proxy commits the sale upstream, then drops the acknowledgement: the hardest retry boundary.
    await Stop(commerce); commerce = null;
    var proxyPort = FreePort();
    using var listener = new HttpListener();
    listener.Prefixes.Add($"http://localhost:{proxyPort}/");
    listener.Start();
    var proxy = Task.Run(async () =>
    {
        var context = await listener.GetContextAsync();
        using var request = new HttpRequestMessage(HttpMethod.Post, backUrl + "/api/sync/sales");
        request.Headers.Add("X-Sync-Key", key);
        request.Content = new StreamContent(context.Request.InputStream);
        request.Content.Headers.ContentType = new MediaTypeHeaderValue("application/json");
        using var response = await http.SendAsync(request);
        Check(response.IsSuccessStatusCode, "5. Upstream committed before connection loss");
        context.Response.Abort();
        listener.Stop();
    });
    commerce = Start("Commerce", commercePort, remoteUrl: $"http://localhost:{proxyPort}");
    await Ready(commerceUrl);
    var interrupted = await CreateSale(sellerToken);
    await proxy.WaitAsync(TimeSpan.FromSeconds(20));
    await Stop(commerce); commerce = null;
    commerce = Start("Commerce", commercePort);
    await Ready(commerceUrl);
    await Synced(interrupted);

    await using (var db = Back())
    {
        var sales = await db.Sales.Include(x => x.Lines).Include(x => x.Payments).Include(x => x.Customer)
            .Include(x => x.User).Include(x => x.CashSession).ToListAsync();
        Check(sales.Count == 4 && sales.Select(x => x.SyncId).Distinct().Count() == 4, "No duplicate after lost acknowledgement");
        Check(sales.All(x => x.Lines.Single().Quantity == 1 && x.Payments.Single().Amount == 23 && x.TotalAmount == 23 &&
            x.DiscountAmount == 2 && x.Customer != null && x.User.Username == "seller-test" && x.CashSession != null), "7. Lines, payments, customer, seller and cash session mapped");
        Check((await db.ProductVariants.SingleAsync()).CurrentStock == 96, "Stock applied once per sale");
        Check((await db.Customers.SingleAsync()).TotalSpentLifetime == 92, "Customer balance applied once per sale");
    }
    foreach (var path in new[] { "/api/sync/status", "/api/sync/pending", "/api/sales", "/api/expenses", "/api/dashboard/summary" })
    {
        using var response = await Authorized(HttpMethod.Get, commerceUrl + path, sellerToken);
        Check(response.StatusCode == HttpStatusCode.Forbidden, "8. Seller denied " + path);
    }
    using (var response = await Authorized(HttpMethod.Post, commerceUrl + "/api/sync/retry", sellerToken))
        Check(response.StatusCode == HttpStatusCode.Forbidden, "Seller denied manual retry");
    using (var response = await http.PostAsJsonAsync(backUrl + "/api/sync/sales", JsonSerializer.Deserialize<SaleSyncDto>(payload)))
        Check(response.StatusCode == HttpStatusCode.Unauthorized, "Sync key required");
    using (var response = await Authorized(HttpMethod.Get, commerceUrl + "/api/sync/status", adminToken))
        Check(response.IsSuccessStatusCode && (await response.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("pending").GetInt32() == 0, "Admin diagnostics show empty queue");
    using (var response = await Authorized(HttpMethod.Post, commerceUrl + "/api/sync/retry", adminToken))
        Check(response.StatusCode == HttpStatusCode.Accepted, "Admin manual retry accepted");
    Console.WriteLine("ALL SYNCHRONIZATION CHECKS PASSED. Test databases retained for inspection.");
}
catch
{
    foreach (var line in logs.TakeLast(60)) Console.Error.WriteLine(line);
    throw;
}
finally
{
    if (commerce != null) await Stop(commerce);
    if (back != null) await Stop(back);
}

BackOfficeDbContext Back() => new(new DbContextOptionsBuilder<BackOfficeDbContext>().UseSqlServer(backConnection).Options);
CommerceDbContext Commerce() => new(new DbContextOptionsBuilder<CommerceDbContext>().UseSqlServer(commerceConnection).Options);
static int FreePort() { var listener = new TcpListener(IPAddress.Loopback, 0); listener.Start(); var port = ((IPEndPoint)listener.LocalEndpoint).Port; listener.Stop(); return port; }
static void Check(bool passed, string name) { if (!passed) throw new Exception("FAIL: " + name); Console.WriteLine("PASS: " + name); }
Process Start(string mode, int port, string? argument = null, string? remoteUrl = null)
{
    var info = new ProcessStartInfo(packagedExecutable ?? "dotnet") { WorkingDirectory = packagedExecutable == null ? backend : Path.GetDirectoryName(packagedExecutable)!, UseShellExecute = false,
        CreateNoWindow = true, RedirectStandardOutput = true, RedirectStandardError = true };
    if (packagedExecutable == null) info.ArgumentList.Add(apiDll);
    if (argument != null) info.ArgumentList.Add(argument);
    info.Environment["ASPNETCORE_URLS"] = $"http://localhost:{port}";
    info.Environment["Database__Provider"] = "SqlServer";
    info.Environment["Installation__Mode"] = mode;
    info.Environment["Installation__NodeId"] = "TEST-POS";
    info.Environment["ConnectionStrings__BackOfficeConnection"] = backConnection;
    info.Environment["ConnectionStrings__CommerceConnection"] = commerceConnection;
    info.Environment["BackOfficeApi__BaseUrl"] = remoteUrl ?? backUrl;
    info.Environment["BackOfficeApi__SyncKey"] = key;
    info.Environment["BackOfficeApi__AllowInsecureHttp"] = "true";
    info.Environment["BackOfficeApi__IntervalSeconds"] = "1";
    info.Environment["BackOfficeApi__TimeoutSeconds"] = "1";
    info.Environment["Jwt__Key"] = key;
    info.Environment["Logging__LogLevel__Default"] = "Warning";
    var process = new Process { StartInfo = info };
    process.OutputDataReceived += (_, e) => { if (e.Data != null) logs.Enqueue(mode + ": " + e.Data); };
    process.ErrorDataReceived += (_, e) => { if (e.Data != null) logs.Enqueue(mode + ": " + e.Data); };
    process.Start(); process.BeginOutputReadLine(); process.BeginErrorReadLine();
    return process;
}
static async Task Stop(Process process)
{
    if (!process.HasExited) process.Kill(entireProcessTree: true);
    await process.WaitForExitAsync(); process.Dispose();
}
async Task Ready(string url)
{
    for (var i = 0; i < 100; i++)
    {
        try { using var response = await http.GetAsync(url + "/api/settings/store"); if (response.IsSuccessStatusCode) return; }
        catch (HttpRequestException) { }
        await Task.Delay(200);
    }
    throw new Exception("API did not start: " + url);
}
async Task<string> Login(string url, string username)
{
    using var response = await http.PostAsJsonAsync(url + "/api/auth/login", new { username, password });
    response.EnsureSuccessStatusCode();
    return (await response.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("token").GetString()!;
}
async Task<HttpResponseMessage> Authorized(HttpMethod method, string url, string token, object? body = null)
{
    using var request = new HttpRequestMessage(method, url);
    request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token);
    if (body != null) request.Content = JsonContent.Create(body);
    return await http.SendAsync(request);
}
async Task<Guid> CreateSale(string token)
{
    await using var db = Commerce();
    using var response = await Authorized(HttpMethod.Post, commerceUrl + "/api/sales", token, new
    {
        userId = -999, customerId = (await db.Customers.SingleAsync()).Id,
        cashSessionId = (await db.CashSessions.SingleAsync()).Id,
        discountAmount = 2, discountReason = "Test discount",
        lines = new[] { new { productVariantId = (await db.ProductVariants.SingleAsync()).Id, quantity = 1 } },
        payments = new[] { new { paymentMethod = "CASH", amount = 23 } }
    });
    response.EnsureSuccessStatusCode();
    return (await response.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("syncId").GetGuid();
}
async Task Synced(Guid syncId)
{
    for (var i = 0; i < 100; i++)
    {
        await using var db = Commerce();
        if (await db.Sales.AnyAsync(x => x.SyncId == syncId && x.IsSynced && x.SyncedAt != null && x.LastSyncError == null)) return;
        await Task.Delay(200);
    }
    throw new Exception("Sale did not synchronize: " + syncId);
}

async Task TestAdoption()
{
    var connection = $"Server={server};Database=TresorSyncTest_Legacy_{testId};Integrated Security=True;TrustServerCertificate=True";
    Console.WriteLine($"Legacy adoption test database: TresorSyncTest_Legacy_{testId}");
    await using (var legacy = new AppDbContext(new DbContextOptionsBuilder<AppDbContext>().UseSqlServer(connection).Options))
    {
        await legacy.Database.MigrateAsync();
        await legacy.Database.ExecuteSqlRawAsync("""
            INSERT dbo.Roles(Name,Description,CreatedAt) VALUES(N'ADMIN',N'Test',SYSUTCDATETIME());
            INSERT dbo.Users(FullName,Username,PasswordHash,RoleId,IsActive,CreatedAt)
                VALUES(N'Legacy',N'legacy',N'not-a-login-hash',SCOPE_IDENTITY(),1,SYSUTCDATETIME());
            INSERT dbo.Sales(SaleNumber,UserId,SaleDate,SubtotalAmount,DiscountAmount,TotalAmount,PaidAmount,RemainingAmount,SaleStatus,CreatedAt)
                VALUES(N'EXISTING-SALE',SCOPE_IDENTITY(),SYSUTCDATETIME(),42,0,42,42,0,N'COMPLETED',SYSUTCDATETIME());
            """);
    }
    await using var adopted = new BackOfficeDbContext(new DbContextOptionsBuilder<BackOfficeDbContext>().UseSqlServer(connection).Options);
    await SqlServerTransition.AdoptAsync(adopted, new ConfigurationBuilder().Build(), NullLogger.Instance);
    var sale = await adopted.Sales.SingleAsync();
    Check(sale.SaleNumber == "EXISTING-SALE" && sale.TotalAmount == 42 && sale.IsSynced && sale.SyncId != Guid.Empty, "Existing SQL sale preserved during backed-up adoption");
    Check(!(await adopted.Database.GetPendingMigrationsAsync()).Any(), "BackOffice migration baseline adopted");
    await SqlServerTransition.AdoptAsync(adopted, new ConfigurationBuilder().Build(), NullLogger.Instance);
    Check(await adopted.Sales.CountAsync() == 1, "Adoption is replayable");
}
