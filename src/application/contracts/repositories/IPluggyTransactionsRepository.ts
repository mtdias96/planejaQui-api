import { TransactionContext } from '../UnitOfWork.js';

export type TransactionStatusFilter = 'POSTED' | 'PENDING' | 'ALL';

export type CurrencyFinancialSummary = {
  currencyCode: string;
  totalInflows: string;
  totalOutflows: string;
  netBalance: string;
  transactionCount: number;
  closingBalance: string | null;
};

export type FinancialSummaryParams = {
  userId: string;
  accountId?: string;
  from?: Date;
  to?: Date;
  status?: TransactionStatusFilter;
};

export type FindByUserAccountsParams = {
  userId: string;
  accountId?: string;
  from?: Date;
  to?: Date;
  status?: TransactionStatusFilter;
  limit?: number;
  offset?: number;
};

export type TransactionWithAccount = {
  id: string;
  accountId: string;
  pluggyTransactionId: string;
  description: string;
  amount: string;
  currencyCode: string;
  date: Date;
  category: string | null;
  categoryId: string | null;
  type: string | null;
  status: string | null;
  balance: string | null;
  raw: Record<string, unknown> | unknown;
  createdAt: Date;
  updatedAt: Date;
  accountName: string | null;
  connectorName: string | null;
};

export type FindByUserAccountsResult = {
  transactions: TransactionWithAccount[];
  total: number;
};

export type NewTransaction = {
  accountId: string;
  pluggyTransactionId: string;
  description: string;
  amount: string;
  currencyCode: string;
  date: Date;
  category?: string | null;
  categoryId?: string | null;
  type?: string | null;
  status?: string | null;
  balance?: string | null;
  raw: Record<string, unknown> | unknown;
};

export interface IPluggyTransactionsRepository {
  findByUserAccounts(
    params: FindByUserAccountsParams,
    tx?: TransactionContext,
  ): Promise<FindByUserAccountsResult>;

  getFinancialSummary(
    params: FinancialSummaryParams,
    tx?: TransactionContext,
  ): Promise<CurrencyFinancialSummary[]>;

  upsertMany(
    transactions: NewTransaction[],
    tx?: TransactionContext,
  ): Promise<void>;
}
