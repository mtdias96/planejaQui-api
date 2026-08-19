import { PluggyAccountsRepository } from '@infra/database/drizzle/repositories/pluggy/PluggyAccountsRepository.js';
import { PluggyTransactionsRepository } from '@infra/database/drizzle/repositories/pluggy/PluggyTransactionsRepository.js';
import { SyncAccountTransactionsService } from '@application/services/pluggy/SyncAccountTransactionsService.js';
import type {
  IPluggyTransactionsRepository,
  TransactionStatusFilter,
} from '@application/contracts/repositories/IPluggyTransactionsRepository.js';

export class ListTransactionsUseCase {
  static inject = [
    SyncAccountTransactionsService,
    PluggyAccountsRepository,
    PluggyTransactionsRepository,
  ];

  constructor(
    private readonly syncAccountTransactionsService: SyncAccountTransactionsService,
    private readonly pluggyAccountsRepository: PluggyAccountsRepository,
    private readonly pluggyTransactionsRepository: IPluggyTransactionsRepository,
  ) {}

  async execute(input: ListTransactionsUseCase.Input): Promise<ListTransactionsUseCase.Output> {
    const fromDate = input.from ? new Date(input.from) : undefined;
    const toDate = input.to ? new Date(input.to) : undefined;

    let sync: SyncAccountTransactionsService.SyncAccountsResult | null = null;

    if (input.sync === true) {
      const accounts = await this.pluggyAccountsRepository.findByUserId(input.userId);

      const accountsToSync = input.accountId
        ? accounts.filter(
            account => account.id === input.accountId || account.pluggyAccountId === input.accountId,
          )
        : accounts;

      sync = await this.syncAccountTransactionsService.syncAccounts({
        accounts: accountsToSync,
        from: fromDate,
        to: toDate,
      });
    }

    const limit = input.limit ?? 50;
    const offset = input.offset ?? 0;

    const { transactions, total } = await this.pluggyTransactionsRepository.findByUserAccounts({
      userId: input.userId,
      accountId: input.accountId,
      from: fromDate,
      to: toDate,
      status: input.status ?? 'POSTED',
      limit,
      offset,
    });

    return {
      transactions: transactions.map(tx => ({
        id: tx.id,
        accountId: tx.accountId,
        pluggyTransactionId: tx.pluggyTransactionId,
        description: tx.description,
        amount: Number(tx.amount),
        currencyCode: tx.currencyCode,
        date: tx.date,
        category: tx.category,
        categoryId: tx.categoryId,
        type: tx.type,
        status: tx.status,
        balance: tx.balance === null ? null : Number(tx.balance),
        accountName: tx.accountName,
        connectorName: tx.connectorName,
      })),
      pagination: {
        total,
        limit,
        offset,
        hasMore: offset + transactions.length < total,
      },
      ...(sync && sync.syncErrors.length > 0
        ? { syncErrors: sync.syncErrors, partialSyncFailure: true }
        : {}),
      ...(sync && sync.truncatedAccounts.length > 0
        ? { truncatedAccounts: sync.truncatedAccounts, historyIncomplete: true }
        : {}),
      ...(sync?.rateLimited ? { rateLimited: true, retryAfter: sync.retryAfterSeconds } : {}),
    };
  }
}

export namespace ListTransactionsUseCase {
  export type Input = {
    userId: string;
    accountId?: string;
    from?: Date | string;
    to?: Date | string;
    status?: TransactionStatusFilter;
    limit?: number;
    offset?: number;
    sync?: boolean;
  };

  export type Transaction = {
    id: string;
    accountId: string;
    pluggyTransactionId: string;
    description: string;
    amount: number;
    currencyCode: string;
    date: Date;
    category: string | null;
    categoryId: string | null;
    type: string | null;
    status: string | null;
    balance: number | null;
    accountName: string | null;
    connectorName: string | null;
  };

  export type Pagination = {
    total: number;
    limit: number;
    offset: number;
    hasMore: boolean;
  };

  export type Output = {
    transactions: Transaction[];
    pagination: Pagination;
    partialSyncFailure?: boolean;
    syncErrors?: { accountId: string; error: string }[];
    truncatedAccounts?: string[];
    historyIncomplete?: boolean;
    rateLimited?: boolean;
    retryAfter?: number;
  };
}
