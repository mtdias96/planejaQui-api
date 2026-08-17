import { DatabaseConnection, DbClient } from '../connection.js';
import { DbTransaction } from '../DrizzleUnitOfWork.js';
import { TransactionContext } from '@application/contracts/UnitOfWork.js';
import {
  pluggyWebhookEvents,
  PluggyWebhookEvent,
  NewPluggyWebhookEvent,
} from '../schemas/pluggyWebhookEvents.js';

export class PluggyWebhookEventsRepository {
  static inject = [DatabaseConnection];

  constructor(private readonly connection: DatabaseConnection) {}

  private getDb(tx?: TransactionContext): DbClient | DbTransaction {
    return (tx as DbTransaction) ?? this.connection.db;
  }

  // Registra o evento de webhook; ignora tentativas repetidas (retorna null se o eventId já existir)
  async record(
    data: NewPluggyWebhookEvent,
    tx?: TransactionContext,
  ): Promise<PluggyWebhookEvent | null> {
    const db = this.getDb(tx);
    const [result] = await db
      .insert(pluggyWebhookEvents)
      .values(data)
      .onConflictDoNothing({ target: pluggyWebhookEvents.eventId })
      .returning();
    return result ?? null;
  }
}
