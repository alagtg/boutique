using Microsoft.Data.SqlClient;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Storage;

namespace Tresor.Api.Data;

public static class SqlServerTransition
{
    public static async Task AdoptAsync(BackOfficeDbContext db, IConfiguration configuration, ILogger logger)
    {
        if (!db.Database.IsSqlServer()) throw new InvalidOperationException("SQL Server is required.");
        await db.Database.OpenConnectionAsync();
        var connection = (SqlConnection)db.Database.GetDbConnection();
        var baseline = db.Database.GetMigrations().First();
        var backupDirectory = configuration["Database:BackupDirectory"];
        if (string.IsNullOrWhiteSpace(backupDirectory))
        {
            using var directoryCommand = connection.CreateCommand();
            directoryCommand.CommandText = "SELECT CONVERT(nvarchar(4000), SERVERPROPERTY('InstanceDefaultBackupPath'))";
            backupDirectory = (await directoryCommand.ExecuteScalarAsync()) as string;
        }
        if (string.IsNullOrWhiteSpace(backupDirectory))
            throw new InvalidOperationException("Set Database:BackupDirectory to a directory writable by the SQL Server service.");
        var backupPath = Path.Combine(backupDirectory, $"Tresor-before-split-{DateTime.UtcNow:yyyyMMddHHmmssfff}-{Guid.NewGuid():N}.bak");
        using (var backup = connection.CreateCommand())
        {
            backup.CommandTimeout = 600;
            backup.CommandText = $"BACKUP DATABASE [{connection.Database.Replace("]", "]]")}] TO DISK = @path WITH COPY_ONLY, CHECKSUM; RESTORE VERIFYONLY FROM DISK = @path WITH CHECKSUM;";
            backup.Parameters.AddWithValue("@path", backupPath);
            await backup.ExecuteNonQueryAsync();
        }
        logger.LogInformation("Verified SQL Server backup: {BackupPath}", backupPath);

        await using var transaction = await db.Database.BeginTransactionAsync();
        var sqlTransaction = (SqlTransaction)transaction.GetDbTransaction();
        async Task Execute(string sql)
        {
            using var command = connection.CreateCommand();
            command.Transaction = sqlTransaction;
            command.CommandText = sql;
            command.CommandTimeout = 120;
            await command.ExecuteNonQueryAsync();
        }
        async Task Add(string table, string column, string definition) => await Execute(
            $"IF COL_LENGTH(N'dbo.{table}', N'{column}') IS NULL ALTER TABLE [dbo].[{table}] ADD [{column}] {definition};");

        // Only the known additions since InitialClean are adopted; an unrelated schema fails below.
        await Execute("""
            IF OBJECT_ID(N'dbo.Sales', N'U') IS NULL OR OBJECT_ID(N'dbo.Customers', N'U') IS NULL
                THROW 50000, 'Expected existing Tresor database. For an empty database use EF migrations.', 1;
            IF EXISTS (SELECT QrCodeToken FROM dbo.Customers WHERE QrCodeToken IS NOT NULL GROUP BY QrCodeToken HAVING COUNT(*) > 1)
                THROW 50000, 'Duplicate customer QR tokens: resolve identity conflicts before adopting.', 1;
            IF EXISTS (SELECT 1 FROM dbo.Customers WHERE LEN(QrCodeToken) > 100)
                THROW 50000, 'Customer QR token exceeds 100 characters; adoption stopped.', 1;
            """);
        await Add("Sales", "SyncId", "uniqueidentifier NOT NULL DEFAULT NEWID() WITH VALUES");
        await Add("Sales", "IsSynced", "bit NOT NULL DEFAULT 1 WITH VALUES");
        await Add("Sales", "SyncedAt", "datetime2 NULL");
        await Add("Sales", "SyncAttempts", "int NOT NULL DEFAULT 0 WITH VALUES");
        await Add("Sales", "LastSyncError", "nvarchar(500) NULL");
        await Add("Sales", "SyncPayload", "nvarchar(max) NULL");
        await Add("Sales", "DiscountReason", "nvarchar(max) NULL");
        await Add("CashSessions", "SyncId", "uniqueidentifier NOT NULL DEFAULT NEWID() WITH VALUES");
        await Add("Expenses", "ReceiptImagePath", "nvarchar(max) NULL");
        await Add("StoreSettings", "WheelPrizes", "nvarchar(max) NOT NULL DEFAULT N'Cadeau boutique|Reduction 10%|Bon achat 20 DT|Surprise prochaine visite' WITH VALUES");
        await Add("StoreSettings", "MonthlyGiftPrize", "nvarchar(max) NOT NULL DEFAULT N'Cadeau mensuel Tresor Boutique' WITH VALUES");
        await Add("StoreSettings", "MonthlyGiftReminderMessage", "nvarchar(max) NOT NULL DEFAULT N'Rappel fin de mois: faites le tirage cadeau parmi tous les clients qui ont achete ce mois.' WITH VALUES");
        await Execute("""
            IF OBJECT_ID(N'dbo.StockPurchases', N'U') IS NULL
            BEGIN
                CREATE TABLE dbo.StockPurchases (
                    Id int IDENTITY(1,1) NOT NULL PRIMARY KEY, ProductVariantId int NOT NULL,
                    Quantity int NOT NULL, UnitPurchasePrice decimal(18,2) NOT NULL,
                    PurchaseDate datetime2 NOT NULL, Notes nvarchar(max) NULL,
                    CreatedAt datetime2 NOT NULL, UpdatedAt datetime2 NULL,
                    CONSTRAINT FK_StockPurchases_ProductVariants_ProductVariantId FOREIGN KEY (ProductVariantId)
                        REFERENCES dbo.ProductVariants(Id) ON DELETE CASCADE
                );
                CREATE INDEX IX_StockPurchases_ProductVariantId ON dbo.StockPurchases(ProductVariantId);
            END;
            IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id=OBJECT_ID(N'dbo.Customers') AND name=N'IX_Customers_QrCodeToken')
            BEGIN
                ALTER TABLE dbo.Customers ALTER COLUMN QrCodeToken nvarchar(100) NULL;
                UPDATE dbo.Customers SET QrCodeToken=CONVERT(nvarchar(100), NEWID()) WHERE QrCodeToken IS NULL OR QrCodeToken='';
                CREATE UNIQUE INDEX IX_Customers_QrCodeToken ON dbo.Customers(QrCodeToken) WHERE QrCodeToken IS NOT NULL;
            END;
            IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id=OBJECT_ID(N'dbo.Sales') AND name=N'IX_Sales_SyncId')
                CREATE UNIQUE INDEX IX_Sales_SyncId ON dbo.Sales(SyncId);
            IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id=OBJECT_ID(N'dbo.Sales') AND name=N'IX_Sales_IsSynced_Id')
                CREATE INDEX IX_Sales_IsSynced_Id ON dbo.Sales(IsSynced,Id);
            IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id=OBJECT_ID(N'dbo.CashSessions') AND name=N'IX_CashSessions_SyncId')
                CREATE UNIQUE INDEX IX_CashSessions_SyncId ON dbo.CashSessions(SyncId);
            """);
        // Verify every mapped column before recording the new context's baseline.
        foreach (var entity in db.Model.GetEntityTypes())
        {
            var table = entity.GetTableName()!;
            var store = Microsoft.EntityFrameworkCore.Metadata.StoreObjectIdentifier.Table(table, entity.GetSchema());
            foreach (var property in entity.GetProperties())
            {
                using var check = connection.CreateCommand();
                check.Transaction = sqlTransaction;
                check.CommandText = "SELECT COUNT(*) FROM sys.columns WHERE object_id=OBJECT_ID(@table) AND name=@column";
                check.Parameters.AddWithValue("@table", "dbo." + table);
                check.Parameters.AddWithValue("@column", property.GetColumnName(store)!);
                if (Convert.ToInt32(await check.ExecuteScalarAsync()) != 1)
                    throw new InvalidOperationException($"Unexpected schema: {table}.{property.Name} missing. Transaction rolled back.");
            }
        }
        await Execute("""
            IF OBJECT_ID(N'dbo.__EFMigrationsHistory', N'U') IS NULL
                CREATE TABLE dbo.__EFMigrationsHistory (MigrationId nvarchar(150) NOT NULL PRIMARY KEY, ProductVersion nvarchar(32) NOT NULL);
            """);
        using (var history = connection.CreateCommand())
        {
            history.Transaction = sqlTransaction;
            history.CommandText = "IF NOT EXISTS (SELECT 1 FROM dbo.__EFMigrationsHistory WHERE MigrationId=@id) INSERT dbo.__EFMigrationsHistory(MigrationId,ProductVersion) VALUES (@id,N'8.0.5')";
            history.Parameters.AddWithValue("@id", baseline);
            await history.ExecuteNonQueryAsync();
        }
        await transaction.CommitAsync();
        logger.LogInformation("Existing database adopted as BackOffice. Existing history and business rows retained.");
    }
}
