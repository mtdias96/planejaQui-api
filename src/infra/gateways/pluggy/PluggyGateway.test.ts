import { describe, it, expect, beforeEach } from 'vitest';
import { PluggyGateway } from './PluggyGateway.js';

class FakePluggyClient {
  public requests: { path: string; query?: Record<string, string | undefined>; body?: unknown }[] = [];
  public responses: unknown[] = [];

  enqueue(...responses: unknown[]) {
    this.responses.push(...responses);
  }

  async get<T>(path: string, query?: Record<string, string | undefined>): Promise<T> {
    this.requests.push({ path, query });
    const res = this.responses.shift();
    if (res instanceof Error) {
      throw res;
    }
    return res as T;
  }

  async post<T>(path: string, body?: unknown): Promise<T> {
    this.requests.push({ path, body });
    const res = this.responses.shift();
    if (res instanceof Error) {
      throw res;
    }
    return res as T;
  }
}

function accountDTO(overrides: Record<string, unknown> = {}) {
  return {
    id: 'acc-1',
    itemId: 'item-1',
    type: 'BANK',
    subtype: 'CHECKING_ACCOUNT',
    number: '1234',
    name: 'Conta Corrente',
    marketingName: 'Conta Fácil',
    balance: 1500.5,
    currencyCode: 'BRL',
    taxNumber: null,
    owner: 'Matheus',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-02T00:00:00.000Z',
    bankData: { transferNumber: '001' },
    ...overrides,
  };
}

function transactionDTO(overrides: Record<string, unknown> = {}) {
  return {
    id: 'tx-1',
    accountId: 'acc-1',
    description: 'Pix Transfer',
    amount: 100.5,
    currencyCode: 'BRL',
    date: '2026-08-16T12:00:00.000Z',
    category: 'Transfers',
    categoryId: '05080000',
    type: 'CREDIT',
    status: 'POSTED',
    createdAt: '2026-08-16T12:00:00.000Z',
    updatedAt: '2026-08-16T12:00:00.000Z',
    ...overrides,
  };
}

describe('PluggyGateway', () => {
  let client: FakePluggyClient;
  let gateway: PluggyGateway;

  beforeEach(() => {
    client = new FakePluggyClient();
    gateway = new PluggyGateway(client as any);
  });

  describe('createConnectToken', () => {
    it('nests clientUserId and webhookUrl under "options"', async () => {
      client.enqueue({ accessToken: 'connect-token' });

      const result = await gateway.createConnectToken({
        clientUserId: 'user-123',
        webhookUrl: 'https://api.planejaqui.test/pluggy/webhook',
      });

      expect(result).toEqual({ accessToken: 'connect-token' });
      expect(client.requests).toHaveLength(1);
      expect(client.requests[0]).toEqual({
        path: '/connect_token',
        body: {
          options: {
            clientUserId: 'user-123',
            webhookUrl: 'https://api.planejaqui.test/pluggy/webhook',
          },
        },
      });
    });

    it('omits webhookUrl when it is not configured', async () => {
      client.enqueue({ accessToken: 'connect-token' });

      await gateway.createConnectToken({ clientUserId: 'user-123' });

      expect(client.requests).toHaveLength(1);
      expect(client.requests[0]).toEqual({
        path: '/connect_token',
        body: {
          options: { clientUserId: 'user-123' },
        },
      });
    });
  });

  describe('listAccounts', () => {
    it('maps accounts to the domain shape and keeps the raw payload', async () => {
      client.enqueue({ page: 1, total: 1, totalPages: 1, results: [accountDTO()] });

      const { accounts } = await gateway.listAccounts({ itemId: 'item-1' });

      expect(accounts).toHaveLength(1);
      expect(accounts[0]).toMatchObject({
        id: 'acc-1',
        type: 'BANK',
        balance: 1500.5,
        currencyCode: 'BRL',
      });
      expect(accounts[0].raw).toMatchObject({ bankData: { transferNumber: '001' } });
    });

    it('follows pagination so accounts are never silently truncated', async () => {
      client.enqueue(
        { page: 1, total: 2, totalPages: 2, results: [accountDTO({ id: 'acc-1' })] },
        { page: 2, total: 2, totalPages: 2, results: [accountDTO({ id: 'acc-2' })] },
      );

      const { accounts } = await gateway.listAccounts({ itemId: 'item-1' });

      expect(accounts.map(account => account.id)).toEqual(['acc-1', 'acc-2']);
      expect(client.requests).toHaveLength(2);
      expect(client.requests[0].query).toEqual({ itemId: 'item-1', page: '1' });
      expect(client.requests[1].query).toEqual({ itemId: 'item-1', page: '2' });
    });
  });

  describe('listTransactions', () => {
    it('maps transactions to domain entities correctly', async () => {
      client.enqueue({ results: [transactionDTO()], next: null });

      const { transactions } = await gateway.listTransactions({ accountId: 'acc-1' });

      expect(transactions).toHaveLength(1);
      expect(transactions[0]).toMatchObject({
        id: 'tx-1',
        description: 'Pix Transfer',
        amount: 100.5,
        currencyCode: 'BRL',
        category: 'Transfers',
        categoryId: '05080000',
        type: 'CREDIT',
        status: 'POSTED',
        date: new Date('2026-08-16T12:00:00.000Z'),
      });
      expect(transactions[0].raw).toMatchObject({ id: 'tx-1' });
    });

    it('follows cursor pagination when next contains a cursor', async () => {
      client.enqueue(
        { results: [transactionDTO({ id: 'tx-1' })], next: '?accountId=acc-1&after=cursor-page-2' },
        { results: [transactionDTO({ id: 'tx-2' })], next: null },
      );

      const { transactions } = await gateway.listTransactions({ accountId: 'acc-1' });

      expect(transactions.map(tx => tx.id)).toEqual(['tx-1', 'tx-2']);
      expect(client.requests).toHaveLength(2);
      expect(client.requests[0].query).toEqual({ accountId: 'acc-1', pageSize: '500', after: undefined });
      expect(client.requests[1].query).toEqual({ accountId: 'acc-1', pageSize: '500', after: 'cursor-page-2' });
    });

    it('extracts cursor from full URL or relative path in next', async () => {
      client.enqueue(
        { results: [transactionDTO({ id: 'tx-1' })], next: 'https://api.pluggy.ai/v2/transactions?after=cursor-from-full-url' },
        { results: [transactionDTO({ id: 'tx-2' })], next: null },
      );

      const { transactions } = await gateway.listTransactions({ accountId: 'acc-1' });

      expect(transactions.map(tx => tx.id)).toEqual(['tx-1', 'tx-2']);
      expect(client.requests[1].query).toEqual({ accountId: 'acc-1', pageSize: '500', after: 'cursor-from-full-url' });
    });

    it('stops pagination and sets truncated: true when MAX_PAGES is reached even if next is present', async () => {
      for (let i = 0; i < 15; i++) {
        client.enqueue({
          results: [transactionDTO({ id: `tx-${i}` })],
          next: `?after=cursor-${i + 1}`,
        });
      }

      const result = await gateway.listTransactions({ accountId: 'acc-1' });

      expect(client.requests).toHaveLength(10);
      expect(result.transactions).toHaveLength(10);
      expect(result.truncated).toBe(true);
    });
  });

  describe('getItem', () => {
    it('maps the item, flattening the connector', async () => {
      client.enqueue({
        id: 'item-1',
        connector: { id: 201, name: 'Pluggy Bank' },
        status: 'UPDATED',
        executionStatus: 'SUCCESS',
        clientUserId: 'user-123',
        lastUpdatedAt: '2026-01-02T00:00:00.000Z',
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-02T00:00:00.000Z',
      });

      const { item } = await gateway.getItem({ itemId: 'item-1' });

      expect(item).toMatchObject({
        id: 'item-1',
        connectorId: 201,
        connectorName: 'Pluggy Bank',
        status: 'UPDATED',
        executionStatus: 'SUCCESS',
        lastSyncedAt: new Date('2026-01-02T00:00:00.000Z'),
      });
    });
  });
});
