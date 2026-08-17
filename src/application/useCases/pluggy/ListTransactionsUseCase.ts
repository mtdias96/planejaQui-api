import { PluggyGateway } from '@infra/gateways/pluggy/PluggyGateway.js';
import { PluggyAccountsRepository } from '@infra/database/drizzle/repositories/PluggyAccountsRepository.js';
import { PluggyTransactionsRepository } from '@infra/database/drizzle/repositories/PluggyTransactionsRepository.js';

export class ListTransactionsUseCase {
  static inject = [
    PluggyGateway,
    PluggyAccountsRepository,
    PluggyTransactionsRepository,
  ];

  constructor(
    private readonly pluggyGateway: PluggyGateway,
    private readonly pluggyAccountsRepository: PluggyAccountsRepository,
    private readonly pluggyTransactionsRepository: PluggyTransactionsRepository,
  ) {}

  async execute(input: ListTransactionsUseCase.Input): Promise<ListTransactionsUseCase.Output> {
    const accounts = await this.pluggyAccountsRepository.findByUserId(input.userId);

    const accountsToSync = input.accountId
      ? accounts.filter(
          account => account.id === input.accountId || account.pluggyAccountId === input.accountId,
        )
      : accounts;

    for (const account of accountsToSync) {
      try {
        const { transactions: fetched } = await this.pluggyGateway.listTransactions({
          accountId: account.pluggyAccountId,
        });

        await this.pluggyTransactionsRepository.upsertMany(
          fetched.map(tx => ({
            accountId: account.id,
            pluggyTransactionId: tx.id,
            description: tx.description,
            amount: String(tx.amount),
            currencyCode: tx.currencyCode ?? account.currencyCode ?? 'BRL',
            date: tx.date,
            category: tx.category,
            categoryId: tx.categoryId,
            type: tx.type,
            status: tx.status,
            raw: tx.raw,
          })),
        );
      } catch (error) {
        // eslint-disable-next-line no-console
        console.error(`[pluggy] failed to sync transactions for account ${account.id}:`, error);
      }
    }

    const transactions = await this.pluggyTransactionsRepository.findByUserAccounts(
      input.userId,
      input.accountId,
    );

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
        accountName: tx.accountName,
        connectorName: tx.connectorName,
      })),
    };
  }
}

export namespace ListTransactionsUseCase {
  export type Input = {
    userId: string;
    accountId?: string;
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
    accountName: string | null;
    connectorName: string | null;
  };

  export type Output = {
    transactions: Transaction[];
  };
}
