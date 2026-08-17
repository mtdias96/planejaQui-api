import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { PluggyGateway } from '@infra/gateways/pluggy/PluggyGateway.js';
import { PluggyWebhookEventsRepository } from '@infra/database/drizzle/repositories/pluggy/PluggyWebhookEventsRepository.js';
import { PluggyItemsRepository } from '@infra/database/drizzle/repositories/pluggy/PluggyItemsRepository.js';
import { UsersRepository } from '@infra/database/drizzle/repositories/UsersRepository.js';

const uuidSchema = z.uuid();

export class HandlePluggyWebhookUseCase {
  static inject = [
    PluggyGateway,
    PluggyWebhookEventsRepository,
    PluggyItemsRepository,
    UsersRepository,
  ];

  constructor(
    private readonly pluggyGateway: PluggyGateway,
    private readonly webhookEventsRepository: PluggyWebhookEventsRepository,
    private readonly pluggyItemsRepository: PluggyItemsRepository,
    private readonly usersRepository: UsersRepository,
  ) {}

  async execute(input: HandlePluggyWebhookUseCase.Input): Promise<HandlePluggyWebhookUseCase.Output> {
    const { payload } = input;

    const recorded = await this.webhookEventsRepository.record({
      eventId: payload.eventId ?? randomUUID(),
      event: payload.event,
      pluggyItemId: payload.itemId ?? null,
      clientUserId: payload.clientUserId ?? null,
      triggeredBy: payload.triggeredBy ?? null,
      payload,
    });

    // Se o evento já foi gravado, ignora para manter a idempotência (Pluggy retenta até 9 vezes)
    if (!recorded) {
      return { processed: false, reason: 'duplicate' };
    }

    return this.linkItemToUser(payload);
  }

  private async linkItemToUser(
    payload: HandlePluggyWebhookUseCase.Payload,
  ): Promise<HandlePluggyWebhookUseCase.Output> {
    const { itemId, clientUserId } = payload;

    if (!itemId || !uuidSchema.safeParse(itemId).success) {
      return { processed: true, reason: 'no-item' };
    }

    const userId = await this.resolveUserId(itemId, clientUserId);

    if (!userId) {
      return { processed: true, reason: 'unknown-user' };
    }

    const details = await this.tryFetchItem(itemId);

    await this.pluggyItemsRepository.upsert({
      userId,
      pluggyItemId: itemId,
      connectorId: details?.connectorId ?? null,
      connectorName: details?.connectorName ?? null,
      status: details?.status ?? null,
      executionStatus: details?.executionStatus ?? null,
      lastSyncedAt: details?.lastSyncedAt ?? null,
    });

    return { processed: true };
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
    reason?: 'duplicate' | 'no-item' | 'unknown-user';
  };
}
