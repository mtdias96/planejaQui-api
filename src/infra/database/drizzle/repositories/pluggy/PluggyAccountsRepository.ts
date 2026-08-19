import { eq, sql, getTableColumns } from 'drizzle-orm';
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
    return db
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
          updatedAt: new Date(),
        },
      })
      .returning();
  }
}
