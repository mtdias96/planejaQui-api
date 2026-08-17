import { eq, sql, and, or, desc } from 'drizzle-orm';
import { DatabaseConnection, DbClient } from '../connection.js';
import { DbTransaction } from '../DrizzleUnitOfWork.js';
import { TransactionContext } from '@application/contracts/UnitOfWork.js';
import { pluggyTransactions, PluggyTransaction, NewPluggyTransaction } from '../schemas/pluggyTransactions.js';
import { pluggyAccounts } from '../schemas/pluggyAccounts.js';
import { pluggyItems } from '../schemas/pluggyItems.js';

export class PluggyTransactionsRepository {
  static inject = [DatabaseConnection];

  constructor(private readonly connection: DatabaseConnection) {}

  private getDb(tx?: TransactionContext): DbClient | DbTransaction {
    return (tx as DbTransaction) ?? this.connection.db;
  }

  async findByUserAccounts(
    userId: string,
    accountId?: string,
    tx?: TransactionContext,
  ): Promise<(PluggyTransaction & { accountName: string | null; connectorName: string | null })[]> {
    const db = this.getDb(tx);

    const conditions = [eq(pluggyItems.userId, userId)];
    if (accountId) {
      conditions.push(
        or(
          eq(pluggyTransactions.accountId, accountId),
          eq(pluggyAccounts.pluggyAccountId, accountId),
        )!,
      );
    }

    const rows = await db
      .select({
        id: pluggyTransactions.id,
        accountId: pluggyTransactions.accountId,
        pluggyTransactionId: pluggyTransactions.pluggyTransactionId,
        description: pluggyTransactions.description,
        amount: pluggyTransactions.amount,
        currencyCode: pluggyTransactions.currencyCode,
        date: pluggyTransactions.date,
        category: pluggyTransactions.category,
        categoryId: pluggyTransactions.categoryId,
        type: pluggyTransactions.type,
        status: pluggyTransactions.status,
        raw: pluggyTransactions.raw,
        createdAt: pluggyTransactions.createdAt,
        updatedAt: pluggyTransactions.updatedAt,
        accountName: pluggyAccounts.name,
        connectorName: pluggyItems.connectorName,
      })
      .from(pluggyTransactions)
      .innerJoin(pluggyAccounts, eq(pluggyTransactions.accountId, pluggyAccounts.id))
      .innerJoin(pluggyItems, eq(pluggyAccounts.itemId, pluggyItems.id))
      .where(and(...conditions))
      .orderBy(desc(pluggyTransactions.date));

    return rows;
  }

  async upsertMany(
    transactions: NewPluggyTransaction[],
    tx?: TransactionContext,
  ): Promise<PluggyTransaction[]> {
    if (transactions.length === 0) {
      return [];
    }

    const db = this.getDb(tx);
    return db
      .insert(pluggyTransactions)
      .values(transactions)
      .onConflictDoUpdate({
        target: pluggyTransactions.pluggyTransactionId,
        set: {
          accountId: sql`excluded.account_id`,
          description: sql`excluded.description`,
          amount: sql`excluded.amount`,
          currencyCode: sql`excluded.currency_code`,
          date: sql`excluded.date`,
          category: sql`excluded.category`,
          categoryId: sql`excluded.category_id`,
          type: sql`excluded.type`,
          status: sql`excluded.status`,
          raw: sql`excluded.raw`,
          updatedAt: new Date(),
        },
      })
      .returning();
  }
}
