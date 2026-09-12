namespace Tresor.Api.Services;

public sealed class SalesSyncSignal
{
    private readonly SemaphoreSlim signal = new(0, 1);
    public void Notify() { try { signal.Release(); } catch (SemaphoreFullException) { } }
    public Task<bool> WaitAsync(TimeSpan delay, CancellationToken ct) => signal.WaitAsync(delay, ct);
}

public sealed class SalesSyncBackgroundService(IServiceScopeFactory scopes, SalesSyncSignal signal,
    BackOfficeApiOptions options, ILogger<SalesSyncBackgroundService> logger) : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                await using var scope = scopes.CreateAsyncScope();
                await scope.ServiceProvider.GetRequiredService<ISalesSyncService>().SyncPendingSalesAsync(stoppingToken);
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested) { break; }
            catch (Exception ex)
            {
                logger.LogError("Sales synchronization pass failed ({ErrorType}); will retry.", ex.GetType().Name);
            }
            try { await signal.WaitAsync(TimeSpan.FromSeconds(options.IntervalSeconds), stoppingToken); }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested) { break; }
        }
    }
}
