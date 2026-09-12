using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;

namespace Tresor.Api.Data;

public static class SqliteTransition
{
    public static async Task InitializeAsync(AppDbContext db)
    {
        var connection = (SqliteConnection)db.Database.GetDbConnection();
        await connection.OpenAsync();
        using (var command = connection.CreateCommand())
        {
            command.CommandText = "SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name='Sales'";
            if (Convert.ToInt32(await command.ExecuteScalarAsync()) == 0)
            {
                await db.Database.EnsureCreatedAsync();
                return;
            }
        }
        var backupPath = Path.GetFullPath(connection.DataSource) + $".backup-{DateTime.UtcNow:yyyyMMddHHmmssfff}";
        using (var backup = new SqliteConnection(new SqliteConnectionStringBuilder { DataSource = backupPath }.ToString()))
        {
            backup.Open();
            connection.BackupDatabase(backup);
        }
        await using var transaction = await connection.BeginTransactionAsync();
        async Task AddColumn(string table, string name, string type)
        {
            using var check = connection.CreateCommand();
            check.Transaction = (SqliteTransaction)transaction;
            check.CommandText = $"PRAGMA table_info(\"{table}\")";
            using (var reader = await check.ExecuteReaderAsync())
            {
                while (await reader.ReadAsync()) if (reader.GetString(1) == name) return;
            }
            using var add = connection.CreateCommand();
            add.Transaction = (SqliteTransaction)transaction;
            add.CommandText = $"ALTER TABLE \"{table}\" ADD COLUMN \"{name}\" {type}";
            await add.ExecuteNonQueryAsync();
        }
        await AddColumn("Sales", "SyncId", "TEXT");
        await AddColumn("Sales", "IsSynced", "INTEGER NOT NULL DEFAULT 1");
        await AddColumn("Sales", "SyncedAt", "TEXT");
        await AddColumn("Sales", "SyncAttempts", "INTEGER NOT NULL DEFAULT 0");
        await AddColumn("Sales", "LastSyncError", "TEXT");
        await AddColumn("Sales", "SyncPayload", "TEXT");
        await AddColumn("CashSessions", "SyncId", "TEXT");
        // Existing IDs are assigned once. No business row or balance is recreated or removed.
        foreach (var table in new[] { "Sales", "CashSessions" })
        {
            var ids = new List<long>();
            using (var query = connection.CreateCommand())
            {
                query.Transaction = (SqliteTransaction)transaction;
                query.CommandText = $"SELECT Id FROM {table} WHERE SyncId IS NULL";
                using var reader = await query.ExecuteReaderAsync();
                while (await reader.ReadAsync()) ids.Add(reader.GetInt64(0));
            }
            foreach (var id in ids)
            {
                using var update = connection.CreateCommand();
                update.Transaction = (SqliteTransaction)transaction;
                update.CommandText = $"UPDATE {table} SET SyncId=$sync WHERE Id=$id";
                update.Parameters.AddWithValue("$sync", Guid.NewGuid());
                update.Parameters.AddWithValue("$id", id);
                await update.ExecuteNonQueryAsync();
            }
        }
        using (var indexes = connection.CreateCommand())
        {
            indexes.Transaction = (SqliteTransaction)transaction;
            indexes.CommandText = """
                CREATE UNIQUE INDEX IF NOT EXISTS IX_Sales_SyncId ON Sales(SyncId);
                CREATE UNIQUE INDEX IF NOT EXISTS IX_CashSessions_SyncId ON CashSessions(SyncId);
                CREATE INDEX IF NOT EXISTS IX_Sales_IsSynced_Id ON Sales(IsSynced,Id);
                CREATE UNIQUE INDEX IF NOT EXISTS IX_Customers_QrCodeToken ON Customers(QrCodeToken);
                """;
            await indexes.ExecuteNonQueryAsync();
        }
        await transaction.CommitAsync();
    }
}
