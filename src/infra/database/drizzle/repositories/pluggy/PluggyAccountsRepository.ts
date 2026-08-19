import { eq, sql, inArray, getTableColumns } from 'drizzle-orm';
import { DatabaseConnection, DbClient } from '../../connection.js';
import { DbTransaction } from '../../DrizzleUnitOfWork.js';
import { TransactionContext } from '@application/contracts/UnitOfWork.js';
import { pluggyAccounts, PluggyAccount, NewPluggyAccount } from '../../schemas/pluggy/pluggyAccounts.js';
import { pluggyItems } from '../../schemas/pluggy/pluggyItems.js';

export class PluggyAccountsRepository {
  static inject = [DatabaseConnection];

  constructor(private readonly connection: DatabaseConnection) {}

  private getDb(tx?: TransactionContext): DbClient | DbTransaction {
    return (tx as DbTransaction) ?? this.connection.db;
  }

  async findByItemId(itemId: string, tx?: TransactionContext): Promise<PluggyAccount[]> {
    const db = this.getDb(tx);
    return db
      .select()
      .from(pluggyAccounts)
      .where(eq(pluggyAccounts.itemId, itemId));
  }

  async findByUserId(
    userId: string,
    tx?: TransactionContext,
  ): Promise<(PluggyAccount & { connectorName: string | null; itemStatus: string | null })[]> {
    const db = this.getDb(tx);
    return db
      .select({
        ...getTableColumns(pluggyAccounts),
        connectorName: pluggyItems.connectorName,
        itemStatus: pluggyItems.status,
      })
      .from(pluggyAccounts)
      .innerJoin(pluggyItems, eq(pluggyAccounts.itemId, pluggyItems.id))
      .where(eq(pluggyItems.userId, userId));
  }

  async upsertMany(
    accounts: NewPluggyAccount[],
    tx?: TransactionContext,
  ): Promise<PluggyAccount[]> {
    if (accounts.length === 0) {
      return [];
    }

    const db = this.getDb(tx);
    const updated = await db
      .insert(pluggyAccounts)
      .values(accounts)
      .onConflictDoUpdate({
        target: pluggyAccounts.pluggyAccountId,
        set: {
          itemId: sql`excluded.item_id`,
          type: sql`excluded.type`,
          subtype: sql`excluded.subtype`,
          name: sql`excluded.name`,
          marketingName: sql`excluded.marketing_name`,
          number: sql`excluded.number`,
          balance: sql`excluded.balance`,
          currencyCode: sql`excluded.currency_code`,
          owner: sql`excluded.owner`,
          taxNumber: sql`excluded.tax_number`,
          raw: sql`excluded.raw`,
          updatedAt: sql`now()`,
        },
        // Evita reescrever linhas idênticas: a conta é reingerida a cada webhook e o `raw`
        // é grande, então updates no-op só gerariam tuplas mortas e pressão de autovacuum.
        setWhere: sql`
          ${pluggyAccounts.itemId} IS DISTINCT FROM excluded.item_id OR
          ${pluggyAccounts.type} IS DISTINCT FROM excluded.type OR
          ${pluggyAccounts.subtype} IS DISTINCT FROM excluded.subtype OR
          ${pluggyAccounts.name} IS DISTINCT FROM excluded.name OR
          ${pluggyAccounts.marketingName} IS DISTINCT FROM excluded.marketing_name OR
          ${pluggyAccounts.number} IS DISTINCT FROM excluded.number OR
          ${pluggyAccounts.balance} IS DISTINCT FROM excluded.balance OR
          ${pluggyAccounts.currencyCode} IS DISTINCT FROM excluded.currency_code OR
          ${pluggyAccounts.owner} IS DISTINCT FROM excluded.owner OR
          ${pluggyAccounts.taxNumber} IS DISTINCT FROM excluded.tax_number
        `,
      })
      .returning();

    if (updated.length === accounts.length) {
      return updated;
    }

    // `setWhere` suprime o RETURNING das linhas inalteradas; relê-las mantém o contrato
    // do método (devolver todas as contas enviadas) sem reescrever nada.
    const untouched = await db
      .select()
      .from(pluggyAccounts)
      .where(inArray(
        pluggyAccounts.pluggyAccountId,
        accounts.map(account => account.pluggyAccountId),
      ));

    const byId = new Map(untouched.map(row => [row.pluggyAccountId, row]));
    for (const row of updated) {
      byId.set(row.pluggyAccountId, row);
    }

    return accounts
      .map(account => byId.get(account.pluggyAccountId))
      .filter((row): row is PluggyAccount => row !== undefined);
  }

  /** Avança a marca d'água da ingestão incremental de transações da conta. */
  async markTransactionsSyncedThrough(
    accountId: string,
    syncedThrough: Date,
    tx?: TransactionContext,
  ): Promise<void> {
    const db = this.getDb(tx);
    await db
      .update(pluggyAccounts)
      .set({ transactionsSyncedThrough: syncedThrough })
      .where(eq(pluggyAccounts.id, accountId));
  }
}
