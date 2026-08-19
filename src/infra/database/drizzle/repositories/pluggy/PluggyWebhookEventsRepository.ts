import { eq, ne, sql } from 'drizzle-orm';
import { DatabaseConnection, DbClient } from '../../connection.js';
import { DbTransaction } from '../../DrizzleUnitOfWork.js';
import { TransactionContext } from '@application/contracts/UnitOfWork.js';
import {
  pluggyWebhookEvents,
  PluggyWebhookEvent,
  NewPluggyWebhookEvent,
} from '../../schemas/pluggy/pluggyWebhookEvents.js';

export class PluggyWebhookEventsRepository {
  static inject = [DatabaseConnection];

  constructor(private readonly connection: DatabaseConnection) {}

  private getDb(tx?: TransactionContext): DbClient | DbTransaction {
    return (tx as DbTransaction) ?? this.connection.db;
  }

  /**
   * Reivindica o evento para processamento e devolve a linha, ou `null` quando ele já foi
   * processado até o fim (`processing_status = 'done'`).
   *
   * A Pluggy retenta a entrega até 9 vezes. Descartar por `eventId` gravado tornaria uma
   * entrega que morreu no meio do processamento (timeout, restart, deploy) impossível de
   * recuperar: o evento constaria como recebido e nenhuma retentativa voltaria a processá-lo.
   * Por isso o descarte olha o estado de processamento, não a mera existência da linha.
   */
  async claim(
    data: NewPluggyWebhookEvent,
    tx?: TransactionContext,
  ): Promise<PluggyWebhookEvent | null> {
    const db = this.getDb(tx);
    const [result] = await db
      .insert(pluggyWebhookEvents)
      .values(data)
      .onConflictDoUpdate({
        target: pluggyWebhookEvents.eventId,
        set: {
          payload: sql`excluded.payload`,
          processingStatus: 'pending',
        },
        setWhere: ne(pluggyWebhookEvents.processingStatus, 'done'),
      })
      .returning();

    return result ?? null;
  }

  async markProcessed(
    eventId: string,
    status: 'done' | 'failed',
    tx?: TransactionContext,
  ): Promise<void> {
    const db = this.getDb(tx);
    await db
      .update(pluggyWebhookEvents)
      .set({ processingStatus: status, processedAt: sql`now()` })
      .where(eq(pluggyWebhookEvents.eventId, eventId));
  }
}
