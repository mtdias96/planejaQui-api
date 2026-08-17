import { eq } from 'drizzle-orm';
import { DatabaseConnection, DbClient } from '../connection.js';
import { DbTransaction } from '../DrizzleUnitOfWork.js';
import { TransactionContext } from '@application/contracts/UnitOfWork.js';
import { pluggyItems, PluggyItem, NewPluggyItem } from '../schemas/pluggyItems.js';

export class PluggyItemsRepository {
  static inject = [DatabaseConnection];

  constructor(private readonly connection: DatabaseConnection) {}

  private getDb(tx?: TransactionContext): DbClient | DbTransaction {
    return (tx as DbTransaction) ?? this.connection.db;
  }

  async findByUserId(userId: string, tx?: TransactionContext): Promise<PluggyItem[]> {
    const db = this.getDb(tx);
    return db
      .select()
      .from(pluggyItems)
      .where(eq(pluggyItems.userId, userId));
  }

  async findByPluggyItemId(
    pluggyItemId: string,
    tx?: TransactionContext,
  ): Promise<PluggyItem | null> {
    const db = this.getDb(tx);
    const [result] = await db
      .select()
      .from(pluggyItems)
      .where(eq(pluggyItems.pluggyItemId, pluggyItemId));
    return result ?? null;
  }

  async upsert(data: NewPluggyItem, tx?: TransactionContext): Promise<PluggyItem> {
    const db = this.getDb(tx);
    const [result] = await db
      .insert(pluggyItems)
      .values(data)
      .onConflictDoUpdate({
        target: pluggyItems.pluggyItemId,
        set: {
          connectorId: data.connectorId,
          connectorName: data.connectorName,
          status: data.status,
          executionStatus: data.executionStatus,
          lastSyncedAt: data.lastSyncedAt,
          updatedAt: new Date(),
        },
      })
      .returning();
    return result;
  }

  async touchSyncedAt(id: string, tx?: TransactionContext): Promise<void> {
    const db = this.getDb(tx);
    await db
      .update(pluggyItems)
      .set({ lastSyncedAt: new Date(), updatedAt: new Date() })
      .where(eq(pluggyItems.id, id));
  }
}
