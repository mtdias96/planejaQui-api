import { PluggyGateway } from '@infra/gateways/pluggy/PluggyGateway.js';
import { PluggyAccountsRepository } from '@infra/database/drizzle/repositories/pluggy/PluggyAccountsRepository.js';
import { PluggyTransactionsRepository } from '@infra/database/drizzle/repositories/pluggy/PluggyTransactionsRepository.js';
import { PluggyRateLimitError } from '@application/errors/pluggy/PluggyRateLimitError.js';
import type {
  IPluggyTransactionsRepository,
  NewTransaction,
} from '@application/contracts/repositories/IPluggyTransactionsRepository.js';

/**
 * Ponto único de ingestão de transações da Pluggy.
 *
 * Existem dois produtores (o webhook e o `GET /pluggy/transactions?sync=true`) e o mapeamento
 * gateway -> linha precisa ser idêntico nos dois: se um ganhar um campo novo e o outro não,
 * a linha fica diferente dependendo de qual caminho a ingeriu, e a divergência é silenciosa.
 */
export class SyncAccountTransactionsService {
  static inject = [
    PluggyGateway,
    PluggyAccountsRepository,
    PluggyTransactionsRepository,
  ];

  /**
   * A Pluggy reclassifica transações (PENDING -> POSTED) e ajusta valor/descrição depois do
   * fato, então a janela incremental volta alguns dias para recapturar o que mudou.
   */
  private static readonly OVERLAP_DAYS = 7;

  constructor(
    private readonly pluggyGateway: PluggyGateway,
    private readonly pluggyAccountsRepository: PluggyAccountsRepository,
    private readonly pluggyTransactionsRepository: IPluggyTransactionsRepository,
  ) {}

  async syncAccounts(
    params: SyncAccountTransactionsService.SyncAccountsParams,
  ): Promise<SyncAccountTransactionsService.SyncAccountsResult> {
    const result: SyncAccountTransactionsService.SyncAccountsResult = {
      syncErrors: [],
      truncatedAccounts: [],
      rateLimited: false,
    };

    for (const account of params.accounts) {
      try {
        const { truncated } = await this.syncAccount({
          account,
          from: params.from,
          to: params.to,
        });

        if (truncated) {
          result.truncatedAccounts.push(account.id);
        }
      } catch (error) {
        result.syncErrors.push({
          accountId: account.id,
          error: error instanceof Error ? error.message : String(error),
        });

        if (error instanceof PluggyRateLimitError) {
          result.rateLimited = true;
          result.retryAfterSeconds = error.retryAfterSeconds;
          // Continuar o laço só produziria mais 429 contra um limite já estourado.
          break;
        }

        // eslint-disable-next-line no-console
        console.error(`[pluggy] failed to sync transactions for account ${account.id}:`, error);
      }
    }

    return result;
  }

  async syncAccount(
    params: SyncAccountTransactionsService.SyncAccountParams,
  ): Promise<SyncAccountTransactionsService.SyncAccountResult> {
    const { account } = params;
    const hasExplicitRange = Boolean(params.from || params.to);
    const from = params.from ?? this.resolveIncrementalFrom(account.transactionsSyncedThrough);

    // Capturado antes da chamada: transações criadas durante a sincronização precisam
    // continuar dentro da próxima janela, e não ficar num buraco entre as duas.
    const syncStartedAt = new Date();

    const { transactions, truncated } = await this.pluggyGateway.listTransactions({
      accountId: account.pluggyAccountId,
      from: this.toPluggyDate(from, -1),
      to: this.toPluggyDate(params.to, 1),
    });

    await this.pluggyTransactionsRepository.upsertMany(
      transactions.map(transaction => this.toRow(transaction, account)),
    );

    // A marca d'água só avança quando a sincronização cobriu tudo até agora. Um intervalo
    // explícito do chamador, ou uma resposta truncada pelo teto de páginas, deixariam um
    // buraco permanente no histórico se fossem registrados como sincronizados.
    if (!hasExplicitRange && !truncated) {
      await this.pluggyAccountsRepository.markTransactionsSyncedThrough(account.id, syncStartedAt);
    }

    return {
      accountId: account.id,
      count: transactions.length,
      truncated: truncated ?? false,
    };
  }

  private toRow(
    transaction: PluggyGateway.Transaction,
    account: SyncAccountTransactionsService.SyncableAccount,
  ): NewTransaction {
    return {
      accountId: account.id,
      pluggyTransactionId: transaction.id,
      description: transaction.description,
      amount: String(transaction.amount),
      currencyCode: transaction.currencyCode ?? account.currencyCode ?? 'BRL',
      date: transaction.date,
      category: transaction.category,
      categoryId: transaction.categoryId,
      type: transaction.type,
      status: transaction.status,
      balance: transaction.balance !== null && transaction.balance !== undefined
        ? String(transaction.balance)
        : null,
      raw: transaction.raw,
    };
  }

  private resolveIncrementalFrom(syncedThrough: Date | null | undefined): Date | undefined {
    if (!syncedThrough) {
      return undefined;
    }

    const from = new Date(syncedThrough);
    from.setUTCDate(from.getUTCDate() - SyncAccountTransactionsService.OVERLAP_DAYS);
    return from;
  }

  /**
   * A API da Pluggy espera `from`/`to` como data civil (`YYYY-MM-DD`), não datetime ISO.
   *
   * Reduzir um instante a uma data em UTC desloca a borda para quem está em outro fuso, então
   * cada ponta é alargada um dia (`direction` -1 no `from`, +1 no `to`) em vez de depender do
   * offset ser negativo para não estreitar a janela. Sobrebuscar é gratuito: o `setWhere` do
   * upsert descarta linhas idênticas, e o filtro que o usuário enxerga é o do banco, feito
   * sobre o timestamp real.
   */
  private toPluggyDate(date: Date | undefined, direction: -1 | 1): string | undefined {
    if (!date) {
      return undefined;
    }

    const widened = new Date(date);
    widened.setUTCDate(widened.getUTCDate() + direction);
    return widened.toISOString().slice(0, 10);
  }
}

export namespace SyncAccountTransactionsService {
  export type SyncableAccount = {
    id: string;
    pluggyAccountId: string;
    currencyCode: string | null;
    transactionsSyncedThrough: Date | null;
  };

  export type SyncAccountParams = {
    account: SyncableAccount;
    from?: Date;
    to?: Date;
  };

  export type SyncAccountResult = {
    accountId: string;
    count: number;
    truncated: boolean;
  };

  export type SyncAccountsParams = {
    accounts: SyncableAccount[];
    from?: Date;
    to?: Date;
  };

  export type SyncAccountsResult = {
    syncErrors: { accountId: string; error: string }[];
    truncatedAccounts: string[];
    rateLimited: boolean;
    retryAfterSeconds?: number;
  };
}
