import { describe, it, expect, beforeEach } from 'vitest';
import { AppConfig } from '@shared/config/AppConfig.js';
import { PluggyGateway } from '@infra/gateways/pluggy/PluggyGateway.js';
import { PluggyItemsRepository } from '@infra/database/drizzle/repositories/pluggy/PluggyItemsRepository.js';
import { PluggyAccountsRepository } from '@infra/database/drizzle/repositories/pluggy/PluggyAccountsRepository.js';
import { PluggyWebhookEventsRepository } from '@infra/database/drizzle/repositories/pluggy/PluggyWebhookEventsRepository.js';
import { UsersRepository } from '@infra/database/drizzle/repositories/UsersRepository.js';
import { PluggyTransactionsRepository } from '@infra/database/drizzle/repositories/pluggy/PluggyTransactionsRepository.js';
import type {
  IPluggyTransactionsRepository,
  FindByUserAccountsParams,
  FinancialSummaryParams,
  CurrencyFinancialSummary,
} from '@application/contracts/repositories/IPluggyTransactionsRepository.js';
import { PluggyItem, NewPluggyItem } from '@infra/database/drizzle/schemas/pluggy/pluggyItems.js';
import { PluggyAccount, NewPluggyAccount } from '@infra/database/drizzle/schemas/pluggy/pluggyAccounts.js';
import { PluggyTransaction, NewPluggyTransaction } from '@infra/database/drizzle/schemas/pluggy/pluggyTransactions.js';
import { NewPluggyWebhookEvent } from '@infra/database/drizzle/schemas/pluggy/pluggyWebhookEvents.js';
import { CreateConnectTokenUseCase } from './CreateConnectTokenUseCase.js';
import { ListAccountsUseCase } from './ListAccountsUseCase.js';
import { ListTransactionsUseCase } from './ListTransactionsUseCase.js';
import { HandlePluggyWebhookUseCase } from './HandlePluggyWebhookUseCase.js';
import { SyncAccountTransactionsService } from '@application/services/pluggy/SyncAccountTransactionsService.js';

const USER_ID = '11111111-1111-4111-8111-111111111111';
const OTHER_USER_ID = '99999999-9999-4999-8999-999999999999';
const PLUGGY_ITEM_ID = '22222222-2222-4222-8222-222222222222';

class FakePluggyGateway extends PluggyGateway {
  constructor() {
    super(null as any);
  }

  public connectTokenCalls: PluggyGateway.CreateConnectTokenParams[] = [];
  public listAccountsCalls: PluggyGateway.ListAccountsParams[] = [];
  public listTransactionsCalls: PluggyGateway.ListTransactionsParams[] = [];
  public accessTokenToReturn = 'fake-access-token';
  public accountsByItemId = new Map<string, PluggyGateway.Account[]>();
  public transactionsByAccountId = new Map<string, PluggyGateway.Transaction[]>();
  public transactionsToReturn: PluggyGateway.Transaction[] = [];
  public itemToReturn: PluggyGateway.Item | null = null;
  public getItemError: Error | null = null;
  public shouldFailTransactions = false;

  override async createConnectToken(input: PluggyGateway.CreateConnectTokenParams) {
    this.connectTokenCalls.push(input);
    return { accessToken: this.accessTokenToReturn };
  }

  override async listAccounts(input: PluggyGateway.ListAccountsParams) {
    this.listAccountsCalls.push(input);
    return { accounts: this.accountsByItemId.get(input.itemId) ?? [] };
  }

  public listTransactionsTruncated = false;

  override async listTransactions(input: PluggyGateway.ListTransactionsParams): Promise<PluggyGateway.ListTransactionsResult> {
    this.listTransactionsCalls.push(input);
    if (this.shouldFailTransactions) {
      throw new Error('Pluggy API temporary failure');
    }
    return {
      transactions: this.transactionsByAccountId.get(input.accountId) ?? this.transactionsToReturn,
      ...(this.listTransactionsTruncated ? { truncated: true } : {}),
    };
  }

  override async getItem(input: PluggyGateway.GetItemParams) {
    if (this.getItemError) {
      throw this.getItemError;
    }

    return {
      item: this.itemToReturn ?? {
        id: input.itemId,
        connectorId: 201,
        connectorName: 'Pluggy Bank',
        status: 'UPDATED',
        executionStatus: 'SUCCESS',
        lastSyncedAt: null,
      },
    };
  }
}

class FakePluggyItemsRepository {
  public items: PluggyItem[] = [];

  async findByUserId(userId: string) {
    return this.items.filter(item => item.userId === userId);
  }

  async findByPluggyItemId(pluggyItemId: string) {
    return this.items.find(item => item.pluggyItemId === pluggyItemId) ?? null;
  }

  async upsert(data: NewPluggyItem) {
    const existing = this.items.find(item => item.pluggyItemId === data.pluggyItemId);
    const record = {
      id: existing?.id ?? `row-${this.items.length + 1}`,
      createdAt: existing?.createdAt ?? new Date(),
      updatedAt: new Date(),
      lastSyncedAt: null,
      connectorId: null,
      connectorName: null,
      status: null,
      executionStatus: null,
      ...data,
    } as PluggyItem;

    this.items = [...this.items.filter(item => item.id !== record.id), record];
    return record;
  }

  async touchSyncedAt(id: string) {
    this.items = this.items.map(item => (
      item.id === id ? { ...item, lastSyncedAt: new Date() } : item
    ));
  }
}

class FakePluggyAccountsRepository {
  public accounts: (PluggyAccount & { connectorName: string | null; itemStatus: string | null })[] = [];
  public upserted: NewPluggyAccount[] = [];

  async findByUserId() {
    return this.accounts;
  }

  async upsertMany(accounts: NewPluggyAccount[]) {
    this.upserted.push(...accounts);
    const created = accounts.map((acc, idx) => ({
      id: `acc-${this.accounts.length + idx + 1}`,
      createdAt: new Date(),
      updatedAt: new Date(),
      marketingName: null,
      number: null,
      owner: null,
      taxNumber: null,
      transactionsSyncedThrough: null,
      connectorName: null,
      itemStatus: null,
      ...acc,
    })) as (PluggyAccount & { connectorName: string | null; itemStatus: string | null })[];
    this.accounts.push(...created);
    return created;
  }

  public watermarks = new Map<string, Date>();

  async markTransactionsSyncedThrough(accountId: string, syncedThrough: Date) {
    this.watermarks.set(accountId, syncedThrough);
    this.accounts = this.accounts.map(acc => (
      acc.id === accountId ? { ...acc, transactionsSyncedThrough: syncedThrough } : acc
    ));
  }
}

class FakePluggyTransactionsRepository implements Partial<IPluggyTransactionsRepository> {
  public transactions: PluggyTransaction[] = [];
  public accounts: (PluggyAccount & { connectorName: string | null; itemStatus: string | null })[] = [];

  async upsertMany(txs: NewPluggyTransaction[]) {
    for (const tx of txs) {
      const existingIdx = this.transactions.findIndex(t => t.pluggyTransactionId === tx.pluggyTransactionId);
      const record = {
        id: `tx-${this.transactions.length + 1}`,
        createdAt: new Date(),
        updatedAt: new Date(),
        category: null,
        categoryId: null,
        type: null,
        status: null,
        ...tx,
      } as PluggyTransaction;

      if (existingIdx >= 0) {
        this.transactions[existingIdx] = record;
      } else {
        this.transactions.push(record);
      }
    }
  }

  async findByUserAccounts(params: FindByUserAccountsParams) {
    let filtered = this.transactions;
    if (params.accountId) {
      const matchingAccount = this.accounts.find(
        a => a.id === params.accountId || a.pluggyAccountId === params.accountId,
      );
      const targetId = matchingAccount ? matchingAccount.id : params.accountId;
      filtered = filtered.filter(t => t.accountId === targetId);
    }
    if (params.from) {
      filtered = filtered.filter(t => new Date(t.date) >= params.from!);
    }
    if (params.to) {
      filtered = filtered.filter(t => new Date(t.date) <= params.to!);
    }
    if (params.status && params.status !== 'ALL') {
      filtered = filtered.filter(t => t.status === params.status);
    }

    const total = filtered.length;
    let paginated = filtered;
    if (params.offset !== undefined) {
      paginated = paginated.slice(params.offset);
    }
    if (params.limit !== undefined) {
      paginated = paginated.slice(0, params.limit);
    }

    const transactions = paginated.map(t => {
      const acc = this.accounts.find(a => a.id === t.accountId);
      return {
        ...t,
        accountName: acc?.name ?? 'Test Account',
        connectorName: acc?.connectorName ?? 'Test Bank',
      };
    });

    return { transactions, total };
  }

  async getFinancialSummary(params: FinancialSummaryParams): Promise<CurrencyFinancialSummary[]> {
    let filtered = this.transactions;
    if (params.accountId) {
      const matchingAccount = this.accounts.find(
        a => a.id === params.accountId || a.pluggyAccountId === params.accountId,
      );
      const targetId = matchingAccount ? matchingAccount.id : params.accountId;
      filtered = filtered.filter(t => t.accountId === targetId);
    }
    if (params.from) {
      filtered = filtered.filter(t => new Date(t.date) >= params.from!);
    }
    if (params.to) {
      filtered = filtered.filter(t => new Date(t.date) <= params.to!);
    }
    if (params.status && params.status !== 'ALL') {
      filtered = filtered.filter(t => t.status === params.status);
    }

    let inflows = 0;
    let outflows = 0;
    let net = 0;

    for (const tx of filtered) {
      const amount = Number(tx.amount);
      if (amount > 0) {
        inflows += amount;
      } else {
        outflows += Math.abs(amount);
      }
      net += amount;
    }

    return [{
      currencyCode: 'BRL',
      totalInflows: String(inflows),
      totalOutflows: String(outflows),
      netBalance: String(net),
      transactionCount: filtered.length,
      closingBalance: null,
    }];
  }
}

class FakePluggyWebhookEventsRepository {
  public recorded: NewPluggyWebhookEvent[] = [];
  public statuses = new Map<string, string>();

  async claim(data: NewPluggyWebhookEvent) {
    // Só uma entrega já processada até o fim conta como duplicata; 'pending'/'failed'
    // continuam reivindicáveis para que a retentativa da Pluggy possa retomá-las.
    if (this.statuses.get(data.eventId) === 'done') {
      return null;
    }

    if (!this.recorded.some(event => event.eventId === data.eventId)) {
      this.recorded.push(data);
    }
    this.statuses.set(data.eventId, 'pending');

    return { ...data, id: 'evt', receivedAt: new Date() } as never;
  }

  async markProcessed(eventId: string, status: 'done' | 'failed') {
    this.statuses.set(eventId, status);
  }
}

class FakeUsersRepository {
  public ids = new Set<string>([USER_ID]);

  async findById(id: string) {
    return this.ids.has(id) ? ({ id } as never) : null;
  }
}

function account(overrides: Partial<PluggyGateway.Account> = {}): PluggyGateway.Account {
  return {
    id: 'acc-1',
    type: 'BANK',
    subtype: 'CHECKING_ACCOUNT',
    name: 'Conta Corrente',
    marketingName: null,
    number: '1234',
    balance: 1500.5,
    currencyCode: 'BRL',
    owner: null,
    taxNumber: null,
    raw: { bankData: { transferNumber: '001' } },
    ...overrides,
  };
}

function syncableAccount(
  overrides: Partial<PluggyAccount & { connectorName: string | null; itemStatus: string | null }> = {},
): PluggyAccount & { connectorName: string | null; itemStatus: string | null } {
  return {
    id: 'acc-1',
    itemId: 'item-1',
    pluggyAccountId: 'pluggy-acc-1',
    type: 'BANK',
    subtype: 'CHECKING_ACCOUNT',
    name: 'Conta Corrente',
    marketingName: null,
    number: '1234',
    balance: '1500',
    currencyCode: 'BRL',
    owner: 'Matheus',
    taxNumber: null,
    raw: {},
    transactionsSyncedThrough: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    connectorName: 'Nubank',
    itemStatus: 'UPDATED',
    ...overrides,
  };
}

describe('CreateConnectTokenUseCase', () => {
  let gateway: FakePluggyGateway;
  let useCase: CreateConnectTokenUseCase;

  beforeEach(() => {
    gateway = new FakePluggyGateway();
    useCase = new CreateConnectTokenUseCase(gateway, new AppConfig(process.env));
  });

  it('returns the access token issued by the gateway', async () => {
    const result = await useCase.execute({ clientUserId: USER_ID });

    expect(result).toEqual({ accessToken: 'fake-access-token' });
  });

  it('binds the token to the authenticated user and to our webhook', async () => {
    await useCase.execute({ clientUserId: USER_ID });

    expect(gateway.connectTokenCalls).toEqual([{
      clientUserId: USER_ID,
      webhookUrl: 'https://api.planejaqui.test/pluggy/webhook',
    }]);
  });
});

describe('ListAccountsUseCase', () => {
  let gateway: FakePluggyGateway;
  let itemsRepository: FakePluggyItemsRepository;
  let accountsRepository: FakePluggyAccountsRepository;
  let useCase: ListAccountsUseCase;

  beforeEach(() => {
    gateway = new FakePluggyGateway();
    itemsRepository = new FakePluggyItemsRepository();
    accountsRepository = new FakePluggyAccountsRepository();
    useCase = new ListAccountsUseCase(
      gateway,
      itemsRepository as unknown as PluggyItemsRepository,
      accountsRepository as unknown as PluggyAccountsRepository,
    );
  });

  it('returns an empty list when the user has no connections', async () => {
    const result = await useCase.execute({ userId: USER_ID });

    expect(result).toEqual({ accounts: [] });
    expect(gateway.listAccountsCalls).toHaveLength(0);
  });

  it('only reads items belonging to the caller', async () => {
    await itemsRepository.upsert({ userId: USER_ID, pluggyItemId: PLUGGY_ITEM_ID });
    await itemsRepository.upsert({
      userId: OTHER_USER_ID,
      pluggyItemId: '33333333-3333-4333-8333-333333333333',
    });

    gateway.accountsByItemId.set(PLUGGY_ITEM_ID, [account({ id: 'acc-mine' })]);
    gateway.accountsByItemId.set('33333333-3333-4333-8333-333333333333', [account({ id: 'acc-other' })]);

    const result = await useCase.execute({ userId: USER_ID });

    expect(result.accounts.map(a => a.id)).toEqual(['acc-mine']);
    expect(gateway.listAccountsCalls).toEqual([{ itemId: PLUGGY_ITEM_ID }]);
  });

  it('caches every account in the local table and updates the sync timestamp', async () => {
    const item = await itemsRepository.upsert({
      userId: USER_ID,
      pluggyItemId: PLUGGY_ITEM_ID,
      connectorName: 'Pluggy Bank',
      status: 'UPDATED',
    });

    gateway.accountsByItemId.set(PLUGGY_ITEM_ID, [
      account({ id: 'acc-1', balance: 1200 }),
      account({ id: 'acc-2', balance: 3400 }),
    ]);

    const result = await useCase.execute({ userId: USER_ID });

    expect(result.accounts).toHaveLength(2);
    expect(result.accounts[0]).toMatchObject({
      connectorName: 'Pluggy Bank',
      itemStatus: 'UPDATED',
    });

    expect(accountsRepository.upserted).toHaveLength(2);
    expect(accountsRepository.upserted[0]).toMatchObject({
      itemId: item.id,
      pluggyAccountId: 'acc-1',
      balance: '1200',
    });

    const refreshed = await itemsRepository.findByPluggyItemId(PLUGGY_ITEM_ID);
    expect(refreshed?.lastSyncedAt).toBeInstanceOf(Date);
  });
});

describe('ListTransactionsUseCase', () => {
  let gateway: FakePluggyGateway;
  let accountsRepo: FakePluggyAccountsRepository;
  let txsRepo: FakePluggyTransactionsRepository;
  let syncService: SyncAccountTransactionsService;
  let useCase: ListTransactionsUseCase;

  beforeEach(() => {
    gateway = new FakePluggyGateway();
    accountsRepo = new FakePluggyAccountsRepository();
    txsRepo = new FakePluggyTransactionsRepository();
    txsRepo.accounts = accountsRepo.accounts;
    syncService = new SyncAccountTransactionsService(
      gateway,
      accountsRepo as unknown as PluggyAccountsRepository,
      txsRepo as unknown as IPluggyTransactionsRepository,
    );
    useCase = new ListTransactionsUseCase(
      syncService,
      accountsRepo as unknown as PluggyAccountsRepository,
      txsRepo as unknown as PluggyTransactionsRepository,
    );
  });

  it('returns empty list when user has no accounts across banks', async () => {
    const result = await useCase.execute({ userId: USER_ID });
    expect(result.transactions).toEqual([]);
    expect(gateway.listTransactionsCalls).toHaveLength(0);
  });

  it('syncs and lists multi-bank transactions in a single unified query', async () => {
    accountsRepo.accounts = [
      {
        id: 'acc-nubank',
        itemId: 'item-nubank',
        pluggyAccountId: 'pluggy-acc-nubank',
        type: 'BANK',
        subtype: 'CHECKING_ACCOUNT',
        name: 'Nubank Corrente',
        marketingName: null,
        number: '1234',
        balance: '1000',
        currencyCode: 'BRL',
        owner: 'Matheus',
        taxNumber: null,
        raw: {},
        createdAt: new Date(),
        updatedAt: new Date(),
        connectorName: 'Nubank',
        transactionsSyncedThrough: null,
        itemStatus: 'UPDATED',
      },
      {
        id: 'acc-itau',
        itemId: 'item-itau',
        pluggyAccountId: 'pluggy-acc-itau',
        type: 'BANK',
        subtype: 'CHECKING_ACCOUNT',
        name: 'Itaú Corrente',
        marketingName: null,
        number: '5678',
        balance: '2500',
        currencyCode: 'BRL',
        owner: 'Matheus',
        taxNumber: null,
        raw: {},
        createdAt: new Date(),
        updatedAt: new Date(),
        connectorName: 'Itaú',
        transactionsSyncedThrough: null,
        itemStatus: 'UPDATED',
      },
    ];
    txsRepo.accounts = accountsRepo.accounts;

    gateway.transactionsByAccountId.set('pluggy-acc-nubank', [
      {
        id: 'pluggy-tx-nubank',
        description: 'Pix Transfer Nubank',
        amount: 150.00,
        currencyCode: 'BRL',
        date: new Date('2026-08-16T12:00:00Z'),
        category: 'Transfer',
        categoryId: '05080000',
        type: 'CREDIT',
        status: 'POSTED',
        raw: {},
      },
    ]);

    gateway.transactionsByAccountId.set('pluggy-acc-itau', [
      {
        id: 'pluggy-tx-itau',
        description: 'Boleto Itaú',
        amount: 250.00,
        currencyCode: 'BRL',
        date: new Date('2026-08-16T11:00:00Z'),
        category: 'Bills',
        categoryId: '01000000',
        type: 'DEBIT',
        status: 'POSTED',
        raw: {},
      },
    ]);

    const result = await useCase.execute({ userId: USER_ID, sync: true });

    expect(gateway.listTransactionsCalls).toHaveLength(2);
    expect(result.transactions).toHaveLength(2);
    expect(result.transactions[0]).toMatchObject({
      description: 'Pix Transfer Nubank',
      amount: 150,
      accountName: 'Nubank Corrente',
      connectorName: 'Nubank',
    });
    expect(result.transactions[1]).toMatchObject({
      description: 'Boleto Itaú',
      amount: 250,
      accountName: 'Itaú Corrente',
      connectorName: 'Itaú',
    });
  });

  it('filters synced accounts by accountId parameter', async () => {
    accountsRepo.accounts = [
      {
        id: 'acc-1',
        itemId: 'item-1',
        pluggyAccountId: 'pluggy-acc-1',
        type: 'BANK',
        subtype: 'CHECKING_ACCOUNT',
        name: 'Account 1',
        marketingName: null,
        number: '1',
        balance: '100',
        currencyCode: 'BRL',
        owner: 'Matheus',
        taxNumber: null,
        raw: {},
        createdAt: new Date(),
        updatedAt: new Date(),
        connectorName: 'Bank 1',
        transactionsSyncedThrough: null,
        itemStatus: 'UPDATED',
      },
      {
        id: 'acc-2',
        itemId: 'item-2',
        pluggyAccountId: 'pluggy-acc-2',
        type: 'BANK',
        subtype: 'CHECKING_ACCOUNT',
        name: 'Account 2',
        marketingName: null,
        number: '2',
        balance: '200',
        currencyCode: 'BRL',
        owner: 'Matheus',
        taxNumber: null,
        raw: {},
        createdAt: new Date(),
        updatedAt: new Date(),
        connectorName: 'Bank 2',
        transactionsSyncedThrough: null,
        itemStatus: 'UPDATED',
      },
    ];
    txsRepo.accounts = accountsRepo.accounts;

    gateway.transactionsToReturn = [
      {
        id: 'pluggy-tx-1',
        description: 'New Transaction Acc 1',
        amount: 50.00,
        currencyCode: 'BRL',
        date: new Date('2026-08-16T12:00:00Z'),
        category: 'Food',
        categoryId: null,
        type: 'DEBIT',
        status: 'POSTED',
        raw: {},
      },
    ];

    const result = await useCase.execute({ userId: USER_ID, accountId: 'pluggy-acc-1', sync: true });

    expect(gateway.listTransactionsCalls).toEqual([{ accountId: 'pluggy-acc-1' }]);
    expect(result.transactions).toHaveLength(1);
    expect(result.transactions[0]).toMatchObject({
      description: 'New Transaction Acc 1',
      amount: 50,
      accountName: 'Account 1',
      connectorName: 'Bank 1',
    });
  });

  it('tolerates gateway errors and still returns cached transactions from the database', async () => {
    accountsRepo.accounts = [
      {
        id: 'acc-1',
        itemId: 'item-1',
        pluggyAccountId: 'pluggy-acc-1',
        type: 'BANK',
        subtype: 'CHECKING_ACCOUNT',
        name: 'Checking Account',
        marketingName: null,
        number: '1234',
        balance: '1000',
        currencyCode: 'BRL',
        owner: 'Matheus',
        taxNumber: null,
        raw: {},
        createdAt: new Date(),
        updatedAt: new Date(),
        connectorName: 'Nubank',
        transactionsSyncedThrough: null,
        itemStatus: 'UPDATED',
      },
    ];
    txsRepo.accounts = accountsRepo.accounts;

    txsRepo.transactions = [
      {
        id: 'tx-cached-1',
        accountId: 'acc-1',
        pluggyTransactionId: 'pluggy-tx-cached',
        description: 'Cached Grocery Expense',
        amount: '85.50' as any,
        currencyCode: 'BRL',
        date: new Date('2026-08-15T10:00:00Z'),
        category: 'Groceries',
        categoryId: null,
        type: 'DEBIT',
        status: 'POSTED',
        balance: null,
        raw: {},
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ];

    gateway.shouldFailTransactions = true;

    const result = await useCase.execute({ userId: USER_ID, sync: true });

    expect(gateway.listTransactionsCalls).toHaveLength(1);
    expect(result.partialSyncFailure).toBe(true);
    expect(result.syncErrors).toHaveLength(1);
    expect(result.transactions).toHaveLength(1);
    expect(result.transactions[0]).toMatchObject({
      description: 'Cached Grocery Expense',
      amount: 85.5,
      accountName: 'Checking Account',
      connectorName: 'Nubank',
    });
  });

  it('reads exclusively from the database without syncing when sync is not specified (default opt-in)', async () => {
    accountsRepo.accounts = [
      {
        id: 'acc-1',
        itemId: 'item-1',
        pluggyAccountId: 'pluggy-acc-1',
        type: 'BANK',
        subtype: 'CHECKING_ACCOUNT',
        name: 'Checking Account',
        marketingName: null,
        number: '1234',
        balance: '1000',
        currencyCode: 'BRL',
        owner: 'Matheus',
        taxNumber: null,
        raw: {},
        createdAt: new Date(),
        updatedAt: new Date(),
        connectorName: 'Nubank',
        transactionsSyncedThrough: null,
        itemStatus: 'UPDATED',
      },
    ];
    txsRepo.accounts = accountsRepo.accounts;

    txsRepo.transactions = [
      {
        id: 'tx-1',
        accountId: 'acc-1',
        pluggyTransactionId: 'ptx-1',
        description: 'DB Read',
        amount: '100.0000',
        currencyCode: 'BRL',
        date: new Date('2026-08-10T10:00:00Z'),
        category: null,
        categoryId: null,
        type: 'CREDIT',
        status: 'POSTED',
        balance: null,
        raw: {},
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ];

    const result = await useCase.execute({ userId: USER_ID });

    expect(gateway.listTransactionsCalls).toHaveLength(0);
    expect(result.transactions).toHaveLength(1);
    expect(result.transactions[0].description).toBe('DB Read');
  });

  it('propagates historyIncomplete and truncatedAccounts when transactions exceed gateway page limits', async () => {
    accountsRepo.accounts = [
      {
        id: 'acc-large',
        itemId: 'item-1',
        pluggyAccountId: 'pluggy-acc-large',
        type: 'BANK',
        subtype: 'CHECKING_ACCOUNT',
        name: 'High Volume Account',
        marketingName: null,
        number: '1234',
        balance: '50000',
        currencyCode: 'BRL',
        owner: 'Matheus',
        taxNumber: null,
        raw: {},
        createdAt: new Date(),
        updatedAt: new Date(),
        connectorName: 'Nubank',
        transactionsSyncedThrough: null,
        itemStatus: 'UPDATED',
      },
    ];
    txsRepo.accounts = accountsRepo.accounts;
    gateway.listTransactionsTruncated = true;

    const result = await useCase.execute({ userId: USER_ID, sync: true });

    expect(result.historyIncomplete).toBe(true);
    expect(result.truncatedAccounts).toEqual(['acc-large']);
  });

  it('does not advance the sync watermark when the gateway truncated the history', async () => {
    accountsRepo.accounts = [syncableAccount()];
    txsRepo.accounts = accountsRepo.accounts;
    gateway.listTransactionsTruncated = true;

    await useCase.execute({ userId: USER_ID, sync: true });

    // Marcar como sincronizado até agora deixaria um buraco permanente no histórico.
    expect(accountsRepo.watermarks.has('acc-1')).toBe(false);
  });

  it('advances the watermark and fetches incrementally on the following sync', async () => {
    accountsRepo.accounts = [syncableAccount()];
    txsRepo.accounts = accountsRepo.accounts;

    await useCase.execute({ userId: USER_ID, sync: true });

    // Primeira sincronização não tem marca d'água: busca o histórico inteiro.
    expect(gateway.listTransactionsCalls[0].from).toBeUndefined();
    const watermark = accountsRepo.watermarks.get('acc-1');
    expect(watermark).toBeInstanceOf(Date);

    await useCase.execute({ userId: USER_ID, sync: true });

    // A segunda volta a janela de sobreposição para recapturar PENDING que virou POSTED,
    // mais um dia de folga da conversão para data civil (7 + 1).
    const incrementalFrom = gateway.listTransactionsCalls[1].from;
    const expected = new Date(watermark!);
    expected.setUTCDate(expected.getUTCDate() - 8);
    expect(incrementalFrom).toBe(expected.toISOString().slice(0, 10));
  });

  it('keeps the watermark untouched when the caller asked for an explicit date range', async () => {
    accountsRepo.accounts = [syncableAccount()];
    txsRepo.accounts = accountsRepo.accounts;

    await useCase.execute({
      userId: USER_ID,
      sync: true,
      from: '2026-01-01T00:00:00.000Z',
      to: '2026-01-31T23:59:59.999Z',
    });

    // Reduzir um instante a uma data civil desloca a borda conforme o fuso, então cada ponta
    // é alargada um dia: a janela enviada nunca é mais estreita que a pedida.
    expect(gateway.listTransactionsCalls[0].from).toBe('2025-12-31');
    expect(gateway.listTransactionsCalls[0].to).toBe('2026-02-01');
    // Um recorte pedido pelo usuário não cobre o presente, então não pode marcar a conta
    // como sincronizada até agora.
    expect(accountsRepo.watermarks.has('acc-1')).toBe(false);
  });
});

describe('HandlePluggyWebhookUseCase', () => {
  let gateway: FakePluggyGateway;
  let eventsRepository: FakePluggyWebhookEventsRepository;
  let itemsRepository: FakePluggyItemsRepository;
  let accountsRepository: FakePluggyAccountsRepository;
  let txsRepository: FakePluggyTransactionsRepository;
  let usersRepository: FakeUsersRepository;
  let useCase: HandlePluggyWebhookUseCase;

  beforeEach(() => {
    gateway = new FakePluggyGateway();
    eventsRepository = new FakePluggyWebhookEventsRepository();
    itemsRepository = new FakePluggyItemsRepository();
    accountsRepository = new FakePluggyAccountsRepository();
    txsRepository = new FakePluggyTransactionsRepository();
    usersRepository = new FakeUsersRepository();
    txsRepository.accounts = accountsRepository.accounts;
    useCase = new HandlePluggyWebhookUseCase(
      gateway,
      eventsRepository as unknown as PluggyWebhookEventsRepository,
      itemsRepository as unknown as PluggyItemsRepository,
      accountsRepository as unknown as PluggyAccountsRepository,
      new SyncAccountTransactionsService(
        gateway,
        accountsRepository as unknown as PluggyAccountsRepository,
        txsRepository as unknown as IPluggyTransactionsRepository,
      ),
      usersRepository as unknown as UsersRepository,
    );
  });

  const itemCreated = {
    event: 'item/created',
    eventId: 'evt-1',
    itemId: PLUGGY_ITEM_ID,
    clientUserId: USER_ID,
    triggeredBy: 'USER',
  };

  it('records the raw delivery, links the item and auto-ingests accounts and transactions', async () => {
    gateway.accountsByItemId.set(PLUGGY_ITEM_ID, [
      {
        id: 'pluggy-acc-webhook',
        type: 'BANK',
        subtype: 'CHECKING_ACCOUNT',
        name: 'Webhook Account',
        marketingName: null,
        number: '999',
        balance: 1500,
        currencyCode: 'BRL',
        owner: 'Matheus',
        taxNumber: null,
        raw: {},
      },
    ]);
    gateway.transactionsToReturn = [
      {
        id: 'pluggy-tx-webhook',
        description: 'Webhook Salary',
        amount: 3000,
        currencyCode: 'BRL',
        date: new Date('2026-08-18T12:00:00Z'),
        category: null,
        categoryId: null,
        type: 'CREDIT',
        status: 'POSTED',
        raw: {},
      },
    ];

    const result = await useCase.execute({ payload: itemCreated });

    expect(result).toEqual({ processed: true });
    expect(eventsRepository.recorded[0]).toMatchObject({
      eventId: 'evt-1',
      event: 'item/created',
      pluggyItemId: PLUGGY_ITEM_ID,
      clientUserId: USER_ID,
    });

    const item = await itemsRepository.findByPluggyItemId(PLUGGY_ITEM_ID);
    expect(item).toMatchObject({
      userId: USER_ID,
      pluggyItemId: PLUGGY_ITEM_ID,
      connectorId: 201,
      connectorName: 'Pluggy Bank',
      status: 'UPDATED',
    });

    expect(accountsRepository.accounts).toHaveLength(1);
    expect(accountsRepository.accounts[0].name).toBe('Webhook Account');
    expect(txsRepository.transactions).toHaveLength(1);
    expect(txsRepository.transactions[0].description).toBe('Webhook Salary');
  });

  it('reprocesses a delivery whose ingestion failed instead of dropping it as a duplicate', async () => {
    gateway.accountsByItemId.set(PLUGGY_ITEM_ID, [account({ id: 'pluggy-acc-webhook' })]);
    gateway.transactionsToReturn = [
      {
        id: 'pluggy-tx-webhook',
        description: 'Webhook Salary',
        amount: 3000,
        currencyCode: 'BRL',
        date: new Date('2026-08-18T12:00:00Z'),
        category: null,
        categoryId: null,
        type: 'CREDIT',
        status: 'POSTED',
        raw: {},
      },
    ];
    gateway.shouldFailTransactions = true;

    const failed = await useCase.execute({ payload: itemCreated });

    expect(failed).toEqual({ processed: true, reason: 'sync-failed' });
    expect(eventsRepository.statuses.get('evt-1')).toBe('failed');
    expect(txsRepository.transactions).toHaveLength(0);

    // A Pluggy retenta a entrega; como o processamento não terminou, ela deve ser retomada.
    gateway.shouldFailTransactions = false;
    const retry = await useCase.execute({ payload: itemCreated });

    expect(retry).toEqual({ processed: true });
    expect(eventsRepository.statuses.get('evt-1')).toBe('done');
    expect(txsRepository.transactions).toHaveLength(1);
  });

  it('links the item without resyncing on events that do not carry new data', async () => {
    gateway.accountsByItemId.set(PLUGGY_ITEM_ID, [account({ id: 'pluggy-acc-webhook' })]);

    const result = await useCase.execute({
      payload: { ...itemCreated, event: 'item/error', eventId: 'evt-error' },
    });

    expect(result).toEqual({ processed: true, reason: 'no-sync' });

    const item = await itemsRepository.findByPluggyItemId(PLUGGY_ITEM_ID);
    expect(item).toMatchObject({ userId: USER_ID, pluggyItemId: PLUGGY_ITEM_ID });

    // Ressincronizar aqui seria custo de API à toa.
    expect(gateway.listAccountsCalls).toHaveLength(0);
    expect(gateway.listTransactionsCalls).toHaveLength(0);
  });

  it('drops duplicate deliveries based on eventId', async () => {
    await useCase.execute({ payload: itemCreated });
    const duplicate = await useCase.execute({ payload: itemCreated });

    expect(duplicate).toEqual({ processed: false, reason: 'duplicate' });
    expect(eventsRepository.recorded).toHaveLength(1);
  });

  it('skips item linking for events without an itemId', async () => {
    const result = await useCase.execute({
      payload: { event: 'connector/status_updated', eventId: 'evt-2' },
    });

    expect(result).toEqual({ processed: true, reason: 'no-item' });
    expect(itemsRepository.items).toHaveLength(0);
  });

  it('does not create a link for an unknown clientUserId', async () => {
    const result = await useCase.execute({
      payload: { ...itemCreated, clientUserId: OTHER_USER_ID },
    });

    expect(result).toEqual({ processed: true, reason: 'unknown-user' });
    expect(itemsRepository.items).toHaveLength(0);
  });

  it('still links the item when fetching its details fails', async () => {
    gateway.getItemError = new Error('pluggy is down');

    const result = await useCase.execute({ payload: itemCreated });

    expect(result).toEqual({ processed: true });
    expect(itemsRepository.items[0]).toMatchObject({
      userId: USER_ID,
      pluggyItemId: PLUGGY_ITEM_ID,
      status: null,
    });
  });
});
