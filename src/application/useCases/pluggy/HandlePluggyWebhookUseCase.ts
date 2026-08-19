import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { PluggyGateway } from '@infra/gateways/pluggy/PluggyGateway.js';
import { PluggyWebhookEventsRepository } from '@infra/database/drizzle/repositories/pluggy/PluggyWebhookEventsRepository.js';
import { PluggyItemsRepository } from '@infra/database/drizzle/repositories/pluggy/PluggyItemsRepository.js';
import { PluggyAccountsRepository } from '@infra/database/drizzle/repositories/pluggy/PluggyAccountsRepository.js';
import { SyncAccountTransactionsService } from '@application/services/pluggy/SyncAccountTransactionsService.js';
import { UsersRepository } from '@infra/database/drizzle/repositories/UsersRepository.js';

const uuidSchema = z.uuid();

export class HandlePluggyWebhookUseCase {
  static inject = [
    PluggyGateway,
    PluggyWebhookEventsRepository,
    PluggyItemsRepository,
    PluggyAccountsRepository,
    SyncAccountTransactionsService,
    UsersRepository,
  ];

  constructor(
    private readonly pluggyGateway: PluggyGateway,
    private readonly webhookEventsRepository: PluggyWebhookEventsRepository,
    private readonly pluggyItemsRepository: PluggyItemsRepository,
    private readonly pluggyAccountsRepository: PluggyAccountsRepository,
    private readonly syncAccountTransactionsService: SyncAccountTransactionsService,
    private readonly usersRepository: UsersRepository,
  ) {}

  /**
   * Eventos que significam dado novo ou atualizado. Os demais (`item/error`, `item/deleted`,
   * `item/waiting_user_input`, `connector/status_updated`...) só atualizam o vínculo do item:
   * ressincronizar neles seria custo de API à toa — e em `item/deleted` recriaria localmente
   * o que acabou de ser removido na Pluggy.
   */
  private static readonly SYNC_TRIGGERING_EVENTS = new Set([
    'item/created',
    'item/updated',
    'transactions/created',
    'transactions/updated',
    'transactions/deleted',
  ]);

  async execute(input: HandlePluggyWebhookUseCase.Input): Promise<HandlePluggyWebhookUseCase.Output> {
    const { payload } = input;
    const eventId = payload.eventId ?? randomUUID();

    const claimed = await this.webhookEventsRepository.claim({
      eventId,
      event: payload.event,
      pluggyItemId: payload.itemId ?? null,
      clientUserId: payload.clientUserId ?? null,
      triggeredBy: payload.triggeredBy ?? null,
      payload,
    });

    // Só descarta o que já foi processado até o fim. A Pluggy retenta a entrega até 9 vezes,
    // e é essa retentativa que recupera um evento cujo processamento morreu no meio.
    if (!claimed) {
      return { processed: false, reason: 'duplicate' };
    }

    try {
      const { output, complete } = await this.processWebhookEvent(payload);
      await this.webhookEventsRepository.markProcessed(eventId, complete ? 'done' : 'failed');
      return output;
    } catch (error) {
      await this.webhookEventsRepository.markProcessed(eventId, 'failed');
      throw error;
    }
  }

  private async processWebhookEvent(
    payload: HandlePluggyWebhookUseCase.Payload,
  ): Promise<{ output: HandlePluggyWebhookUseCase.Output; complete: boolean }> {
    const { itemId, clientUserId } = payload;

    if (!itemId || !uuidSchema.safeParse(itemId).success) {
      return { output: { processed: true, reason: 'no-item' }, complete: true };
    }

    const userId = await this.resolveUserId(itemId, clientUserId);

    if (!userId) {
      return { output: { processed: true, reason: 'unknown-user' }, complete: true };
    }

    const details = await this.tryFetchItem(itemId);

    const item = await this.pluggyItemsRepository.upsert({
      userId,
      pluggyItemId: itemId,
      connectorId: details?.connectorId ?? null,
      connectorName: details?.connectorName ?? null,
      status: details?.status ?? null,
      executionStatus: details?.executionStatus ?? null,
      lastSyncedAt: details?.lastSyncedAt ?? null,
    });

    if (!HandlePluggyWebhookUseCase.SYNC_TRIGGERING_EVENTS.has(payload.event)) {
      return { output: { processed: true, reason: 'no-sync' }, complete: true };
    }

    const synced = await this.syncAccountsAndTransactions(item.id, itemId);

    // Falha de ingestão deixa o evento reivindicável de novo, para que a retentativa da
    // Pluggy sirva de recuperação em vez de ser descartada como duplicata.
    return {
      output: synced.ok ? { processed: true } : { processed: true, reason: 'sync-failed' },
      complete: synced.ok,
    };
  }

  private async syncAccountsAndTransactions(
    localItemId: string,
    pluggyItemId: string,
  ): Promise<{ ok: boolean }> {
    try {
      const { accounts } = await this.pluggyGateway.listAccounts({ itemId: pluggyItemId });

      const upsertedAccounts = await this.pluggyAccountsRepository.upsertMany(
        accounts.map(account => ({
          itemId: localItemId,
          pluggyAccountId: account.id,
          type: account.type,
          subtype: account.subtype,
          name: account.name,
          marketingName: account.marketingName,
          number: account.number,
          balance: String(account.balance),
          currencyCode: account.currencyCode,
          owner: account.owner,
          taxNumber: account.taxNumber,
          raw: account.raw,
        })),
      );

      const result = await this.syncAccountTransactionsService.syncAccounts({
        accounts: upsertedAccounts,
      });

      if (result.truncatedAccounts.length > 0) {
        // eslint-disable-next-line no-console
        console.warn(
          `[pluggy-webhook] history truncated by the gateway page cap for accounts: ${result.truncatedAccounts.join(', ')}`,
        );
      }

      return { ok: result.syncErrors.length === 0 };
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error(`[pluggy-webhook] failed to sync accounts for item ${pluggyItemId}:`, error);
      return { ok: false };
    }
  }

  private async resolveUserId(itemId: string, clientUserId?: string | null): Promise<string | null> {
    const existing = await this.pluggyItemsRepository.findByPluggyItemId(itemId);

    if (existing) {
      return existing.userId;
    }

    if (!clientUserId || !uuidSchema.safeParse(clientUserId).success) {
      return null;
    }

    const user = await this.usersRepository.findById(clientUserId);

    return user ? user.id : null;
  }

  private async tryFetchItem(itemId: string): Promise<PluggyGateway.Item | null> {
    try {
      const { item } = await this.pluggyGateway.getItem({ itemId });
      return item;
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('[pluggy] failed to fetch item details from webhook', { itemId, error });
      return null;
    }
  }
}

export namespace HandlePluggyWebhookUseCase {
  export type Payload = {
    event: string;
    eventId?: string;
    itemId?: string | null;
    clientUserId?: string | null;
    triggeredBy?: string | null;
  } & Record<string, unknown>;

  export type Input = {
    payload: Payload;
  };

  export type Output = {
    processed: boolean;
    reason?: 'duplicate' | 'no-item' | 'unknown-user' | 'no-sync' | 'sync-failed';
  };
}
