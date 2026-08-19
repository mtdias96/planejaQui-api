import { describe, it, expect, beforeEach } from 'vitest';
import { GetTransactionsSummaryUseCase } from './GetTransactionsSummaryUseCase.js';
import {
  IPluggyTransactionsRepository,
  FinancialSummaryParams,
  CurrencyFinancialSummary,
} from '@application/contracts/repositories/IPluggyTransactionsRepository.js';
import { PluggyTransaction } from '@infra/database/drizzle/schemas/pluggy/pluggyTransactions.js';

const USER_ID = '11111111-1111-4111-8111-111111111111';

class FakePluggyTransactionsRepository implements Partial<IPluggyTransactionsRepository> {
  public transactions: PluggyTransaction[] = [];
  public accountBalances = new Map<string, string>(); // currency -> totalBalance

  async getFinancialSummary(params: FinancialSummaryParams): Promise<CurrencyFinancialSummary[]> {
    let filtered = this.transactions;

    if (params.accountId) {
      filtered = filtered.filter(t => t.accountId === params.accountId);
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

    if (filtered.length === 0) {
      return [{
        currencyCode: 'BRL',
        totalInflows: '0',
        totalOutflows: '0',
        netBalance: '0',
        transactionCount: 0,
        closingBalance: this.accountBalances.get('BRL') ?? null,
      }];
    }

    const byCurrency = new Map<string, { inflows: number; outflows: number; net: number; count: number }>();

    for (const tx of filtered) {
      const curr = tx.currencyCode ?? 'BRL';
      const existing = byCurrency.get(curr) ?? { inflows: 0, outflows: 0, net: 0, count: 0 };
      const amount = Number(tx.amount);
      const isCredit = tx.type?.toUpperCase() === 'CREDIT' || (!tx.type && amount > 0);
      const isDebit = tx.type?.toUpperCase() === 'DEBIT' || (!tx.type && amount < 0);

      if (isCredit) {
        existing.inflows += Math.abs(amount);
        existing.net += Math.abs(amount);
      } else if (isDebit) {
        existing.outflows += Math.abs(amount);
        existing.net -= Math.abs(amount);
      } else {
        existing.net += amount;
      }
      existing.count += 1;
      byCurrency.set(curr, existing);
    }

    return Array.from(byCurrency.entries()).map(([currencyCode, data]) => ({
      currencyCode,
      totalInflows: String(data.inflows),
      totalOutflows: String(data.outflows),
      netBalance: String(data.net),
      transactionCount: data.count,
      closingBalance: this.accountBalances.get(currencyCode) ?? null,
    }));
  }
}

describe('GetTransactionsSummaryUseCase', () => {
  let txsRepo: FakePluggyTransactionsRepository;
  let useCase: GetTransactionsSummaryUseCase;

  beforeEach(() => {
    txsRepo = new FakePluggyTransactionsRepository();
    txsRepo.accountBalances.set('BRL', '3749.75');
    useCase = new GetTransactionsSummaryUseCase(
      txsRepo as unknown as IPluggyTransactionsRepository,
    );
  });

  it('calculates zero values when no transactions exist in the given month', async () => {
    txsRepo.accountBalances.clear();
    const result = await useCase.execute({
      userId: USER_ID,
      month: '2026-08',
    });

    expect(result).toMatchObject({
      period: {
        month: '2026-08',
        from: '2026-08-01T03:00:00.000Z',
        to: '2026-09-01T02:59:59.999Z',
      },
      inflows: 0,
      outflows: 0,
      netBalance: 0,
      transactionCount: 0,
      closingBalance: null,
      currentBalance: null,
      currencyCode: 'BRL',
    });
  });

  it('returns null closingBalance for historical past months while preserving currentBalance', async () => {
    txsRepo.transactions = [
      {
        id: 'tx-old',
        accountId: 'acc-1',
        pluggyTransactionId: 'ptx-old',
        description: 'Past Income',
        amount: '1000.0000',
        currencyCode: 'BRL',
        date: new Date('2024-01-15T12:00:00Z'),
        category: null,
        categoryId: null,
        type: 'CREDIT',
        status: 'POSTED',
        balance: '1000.0000',
        raw: {},
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ];

    const result = await useCase.execute({
      userId: USER_ID,
      month: '2024-01',
    });

    expect(result.inflows).toBe(1000);
    expect(result.closingBalance).toBeNull();
    expect(result.currentBalance).toBe(3749.75);
    expect(result.period.month).toBe('2024-01');
  });

  it('aggregates inflows (CREDIT), outflows (DEBIT) and net balance correctly for a given month in Sao Paulo timezone', async () => {
    txsRepo.transactions = [
      {
        id: 'tx-1',
        accountId: 'acc-1',
        pluggyTransactionId: 'ptx-1',
        description: 'Salary',
        amount: '5000.0000',
        currencyCode: 'BRL',
        date: new Date('2026-08-05T10:00:00-03:00'),
        category: 'Income',
        categoryId: null,
        type: 'CREDIT',
        status: 'POSTED',
        balance: '5000.0000',
        raw: {},
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: 'tx-2',
        accountId: 'acc-1',
        pluggyTransactionId: 'ptx-2',
        description: 'Freelance',
        amount: '1200.5000',
        currencyCode: 'BRL',
        date: new Date('2026-08-10T14:00:00-03:00'),
        category: 'Income',
        categoryId: null,
        type: 'CREDIT',
        status: 'POSTED',
        balance: '6200.5000',
        raw: {},
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: 'tx-3',
        accountId: 'acc-1',
        pluggyTransactionId: 'ptx-3',
        description: 'Rent',
        amount: '2000.0000',
        currencyCode: 'BRL',
        date: new Date('2026-08-12T09:00:00-03:00'),
        category: 'Housing',
        categoryId: null,
        type: 'DEBIT',
        status: 'POSTED',
        balance: '4200.5000',
        raw: {},
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: 'tx-4',
        accountId: 'acc-1',
        pluggyTransactionId: 'ptx-4',
        description: 'Supermarket',
        amount: '-450.7500',
        currencyCode: 'BRL',
        date: new Date('2026-08-15T18:00:00-03:00'),
        category: 'Groceries',
        categoryId: null,
        type: 'DEBIT',
        status: 'POSTED',
        balance: '3749.7500',
        raw: {},
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      // PENDING transaction (should be excluded by default status=POSTED)
      {
        id: 'tx-pending',
        accountId: 'acc-1',
        pluggyTransactionId: 'ptx-pending',
        description: 'Pending Coffee',
        amount: '-15.0000',
        currencyCode: 'BRL',
        date: new Date('2026-08-16T12:00:00-03:00'),
        category: 'Food',
        categoryId: null,
        type: 'DEBIT',
        status: 'PENDING',
        balance: '3734.7500',
        raw: {},
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      // July expense (excluded)
      {
        id: 'tx-5',
        accountId: 'acc-1',
        pluggyTransactionId: 'ptx-5',
        description: 'July Expense',
        amount: '-100.0000',
        currencyCode: 'BRL',
        date: new Date('2026-07-25T12:00:00-03:00'),
        category: 'Other',
        categoryId: null,
        type: 'DEBIT',
        status: 'POSTED',
        balance: '1000.0000',
        raw: {},
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ];

    const result = await useCase.execute({
      userId: USER_ID,
      month: '2026-08',
    });

    expect(result.inflows).toBe(6200.5);
    expect(result.outflows).toBe(2450.75);
    expect(result.netBalance).toBe(3749.75);
    expect(result.transactionCount).toBe(4);
    expect(result.closingBalance).toBe(3749.75);
    expect(result.currentBalance).toBe(3749.75);
    expect(result.period.month).toBe('2026-08');
  });

  it('includes PENDING transactions when status is explicitly set to ALL', async () => {
    txsRepo.transactions = [
      {
        id: 'tx-1',
        accountId: 'acc-1',
        pluggyTransactionId: 'ptx-1',
        description: 'Confirmed Salary',
        amount: '3000.0000',
        currencyCode: 'BRL',
        date: new Date('2026-08-01T10:00:00Z'),
        category: null,
        categoryId: null,
        type: 'CREDIT',
        status: 'POSTED',
        balance: '3000.0000',
        raw: {},
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: 'tx-2',
        accountId: 'acc-1',
        pluggyTransactionId: 'ptx-2',
        description: 'Pending Bill',
        amount: '500.0000',
        currencyCode: 'BRL',
        date: new Date('2026-08-02T10:00:00Z'),
        category: null,
        categoryId: null,
        type: 'DEBIT',
        status: 'PENDING',
        balance: '2500.0000',
        raw: {},
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ];

    const result = await useCase.execute({
      userId: USER_ID,
      month: '2026-08',
      status: 'ALL',
    });

    expect(result.inflows).toBe(3000);
    expect(result.outflows).toBe(500);
    expect(result.netBalance).toBe(2500);
    expect(result.transactionCount).toBe(2);
  });

  it('filters summary by specific accountId when supplied', async () => {
    txsRepo.transactions = [
      {
        id: 'tx-1',
        accountId: 'acc-checking',
        pluggyTransactionId: 'ptx-1',
        description: 'Checking Income',
        amount: '1000.0000',
        currencyCode: 'BRL',
        date: new Date('2026-08-10T10:00:00Z'),
        category: null,
        categoryId: null,
        type: 'CREDIT',
        status: 'POSTED',
        balance: '1000.0000',
        raw: {},
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: 'tx-2',
        accountId: 'acc-savings',
        pluggyTransactionId: 'ptx-2',
        description: 'Savings Income',
        amount: '500.0000',
        currencyCode: 'BRL',
        date: new Date('2026-08-10T10:00:00Z'),
        category: null,
        categoryId: null,
        type: 'CREDIT',
        status: 'POSTED',
        balance: '500.0000',
        raw: {},
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ];

    const result = await useCase.execute({
      userId: USER_ID,
      accountId: 'acc-checking',
      month: '2026-08',
    });

    expect(result.inflows).toBe(1000);
    expect(result.transactionCount).toBe(1);
  });

  it('handles isolated from parameter without assigning incorrect month label', async () => {
    txsRepo.transactions = [
      {
        id: 'tx-1',
        accountId: 'acc-1',
        pluggyTransactionId: 'ptx-1',
        description: 'Salary',
        amount: '2000.0000',
        currencyCode: 'BRL',
        date: new Date('2026-01-15T12:00:00Z'),
        category: null,
        categoryId: null,
        type: 'CREDIT',
        status: 'POSTED',
        balance: '2000.0000',
        raw: {},
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ];

    const result = await useCase.execute({
      userId: USER_ID,
      from: '2026-01-01T00:00:00.000Z',
    });

    expect(result.inflows).toBe(2000);
    expect(result.period.month).toBeUndefined();
    expect(result.period.from).toBe('2026-01-01T00:00:00.000Z');
  });

  it('supports multi-currency accounts and segregates amounts by currency', async () => {
    txsRepo.accountBalances.set('BRL', '1000');
    txsRepo.accountBalances.set('USD', '500');

    txsRepo.transactions = [
      {
        id: 'tx-brl',
        accountId: 'acc-brl',
        pluggyTransactionId: 'ptx-brl',
        description: 'Pix BRL',
        amount: '1000.0000',
        currencyCode: 'BRL',
        date: new Date('2026-08-10T12:00:00-03:00'),
        category: null,
        categoryId: null,
        type: 'CREDIT',
        status: 'POSTED',
        balance: '1000.0000',
        raw: {},
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: 'tx-usd',
        accountId: 'acc-usd',
        pluggyTransactionId: 'ptx-usd',
        description: 'USD Deposit',
        amount: '500.0000',
        currencyCode: 'USD',
        date: new Date('2026-08-10T12:00:00-03:00'),
        category: null,
        categoryId: null,
        type: 'CREDIT',
        status: 'POSTED',
        balance: '500.0000',
        raw: {},
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ];

    const result = await useCase.execute({
      userId: USER_ID,
      month: '2026-08',
    });

    expect(result.byCurrency).toHaveLength(2);
    const usd = result.byCurrency.find(c => c.currencyCode === 'USD');
    const brl = result.byCurrency.find(c => c.currencyCode === 'BRL');
    expect(usd?.inflows).toBe(500);
    expect(usd?.closingBalance).toBe(500);
    expect(usd?.currentBalance).toBe(500);
    expect(brl?.inflows).toBe(1000);
    expect(brl?.closingBalance).toBe(1000);
    expect(brl?.currentBalance).toBe(1000);
  });
});
