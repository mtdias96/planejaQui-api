import { PluggyTransactionsRepository } from '@infra/database/drizzle/repositories/pluggy/PluggyTransactionsRepository.js';
import type {
  IPluggyTransactionsRepository,
  TransactionStatusFilter,
} from '@application/contracts/repositories/IPluggyTransactionsRepository.js';
import { getSaoPauloMonthRange } from '@shared/utils/date.js';

export class GetTransactionsSummaryUseCase {
  static inject = [PluggyTransactionsRepository];

  constructor(private readonly pluggyTransactionsRepository: IPluggyTransactionsRepository) {}

  async execute(
    input: GetTransactionsSummaryUseCase.Input,
  ): Promise<GetTransactionsSummaryUseCase.Output> {
    const { fromDate, toDate, formattedMonth } = this.resolveDateRange(input);

    const summaries = await this.pluggyTransactionsRepository.getFinancialSummary({
      userId: input.userId,
      accountId: input.accountId,
      from: fromDate,
      to: toDate,
      status: input.status ?? 'POSTED',
    });

    const primary = summaries[0] ?? {
      currencyCode: 'BRL',
      totalInflows: '0',
      totalOutflows: '0',
      netBalance: '0',
      transactionCount: 0,
      closingBalance: null,
    };

    const isCurrentOrFuturePeriod = toDate.getTime() >= Date.now();

    const byCurrency: GetTransactionsSummaryUseCase.CurrencySummary[] = summaries.map(s => {
      const balanceNum = s.closingBalance !== null ? Number(s.closingBalance) : null;
      return {
        currencyCode: s.currencyCode,
        inflows: Number(s.totalInflows),
        outflows: Number(s.totalOutflows),
        netBalance: Number(s.netBalance),
        transactionCount: s.transactionCount,
        closingBalance: isCurrentOrFuturePeriod ? balanceNum : null,
        currentBalance: balanceNum,
      };
    });

    const primaryBalance = primary.closingBalance !== null ? Number(primary.closingBalance) : null;

    return {
      period: {
        ...(formattedMonth ? { month: formattedMonth } : {}),
        from: fromDate.toISOString(),
        to: toDate.toISOString(),
      },
      inflows: Number(primary.totalInflows),
      outflows: Number(primary.totalOutflows),
      netBalance: Number(primary.netBalance),
      transactionCount: primary.transactionCount,
      closingBalance: isCurrentOrFuturePeriod ? primaryBalance : null,
      currentBalance: primaryBalance,
      currencyCode: primary.currencyCode,
      byCurrency,
    };
  }

  private resolveDateRange(input: GetTransactionsSummaryUseCase.Input): {
    fromDate: Date;
    toDate: Date;
    formattedMonth?: string;
  } {
    if (input.from || input.to) {
      const fromDate = input.from ? new Date(input.from) : new Date(0);
      const toDate = input.to ? new Date(input.to) : new Date();

      return {
        fromDate,
        toDate,
        formattedMonth: undefined,
      };
    }

    return getSaoPauloMonthRange(input.month);
  }
}

export namespace GetTransactionsSummaryUseCase {
  export type Input = {
    userId: string;
    accountId?: string;
    month?: string;
    from?: string | Date;
    to?: string | Date;
    status?: TransactionStatusFilter;
  };

  export type Period = {
    month?: string;
    from: string;
    to: string;
  };

  export type CurrencySummary = {
    currencyCode: string;
    inflows: number;
    outflows: number;
    netBalance: number;
    transactionCount: number;
    closingBalance: number | null;
    currentBalance: number | null;
  };

  export type Output = {
    period: Period;
    inflows: number;
    outflows: number;
    netBalance: number;
    transactionCount: number;
    closingBalance: number | null;
    currentBalance: number | null;
    currencyCode: string;
    byCurrency: CurrencySummary[];
  };
}
