import { eq, sql, and, or, desc, gte, lte } from 'drizzle-orm';
import { DatabaseConnection, DbClient } from '../../connection.js';
import { DbTransaction } from '../../DrizzleUnitOfWork.js';
import { TransactionContext } from '@application/contracts/UnitOfWork.js';
import type {
  IPluggyTransactionsRepository,
  CurrencyFinancialSummary,
  FinancialSummaryParams,
  FindByUserAccountsParams,
  FindByUserAccountsResult,
  NewTransaction,
} from '@application/contracts/repositories/IPluggyTransactionsRepository.js';
import { pluggyTransactions, NewPluggyTransaction } from '../../schemas/pluggy/pluggyTransactions.js';
import { pluggyAccounts } from '../../schemas/pluggy/pluggyAccounts.js';
import { pluggyItems } from '../../schemas/pluggy/pluggyItems.js';

export class PluggyTransactionsRepository implements IPluggyTransactionsRepository {
  static inject = [DatabaseConnection];

  constructor(private readonly connection: DatabaseConnection) {}

  private getDb(tx?: TransactionContext): DbClient | DbTransaction {
    return (tx as DbTransaction) ?? this.connection.db;
  }

  async findByUserAccounts(
    params: FindByUserAccountsParams,
    tx?: TransactionContext,
  ): Promise<FindByUserAccountsResult> {
    const db = this.getDb(tx);

    const conditions = [eq(pluggyItems.userId, params.userId)];
    if (params.accountId) {
      conditions.push(
        or(
          eq(pluggyTransactions.accountId, params.accountId),
          eq(pluggyAccounts.pluggyAccountId, params.accountId),
        )!,
      );
    }
    if (params.from) {
      conditions.push(gte(pluggyTransactions.date, params.from));
    }
    if (params.to) {
      conditions.push(lte(pluggyTransactions.date, params.to));
    }
    if (params.status && params.status !== 'ALL') {
      conditions.push(eq(pluggyTransactions.status, params.status));
    }

    const [countRow] = await db
      .select({ count: sql<number>`CAST(COUNT(*) AS INT)` })
      .from(pluggyTransactions)
      .innerJoin(pluggyAccounts, eq(pluggyTransactions.accountId, pluggyAccounts.id))
      .innerJoin(pluggyItems, eq(pluggyAccounts.itemId, pluggyItems.id))
      .where(and(...conditions));

    const total = countRow?.count ?? 0;

    let query = db
      .select({
        id: pluggyTransactions.id,
        accountId: pluggyTransactions.accountId,
        pluggyTransactionId: pluggyTransactions.pluggyTransactionId,
        description: pluggyTransactions.description,
        amount: pluggyTransactions.amount,
        currencyCode: pluggyTransactions.currencyCode,
        date: pluggyTransactions.date,
        category: pluggyTransactions.category,
        categoryId: pluggyTransactions.categoryId,
        type: pluggyTransactions.type,
        status: pluggyTransactions.status,
        balance: pluggyTransactions.balance,
        raw: pluggyTransactions.raw,
        createdAt: pluggyTransactions.createdAt,
        updatedAt: pluggyTransactions.updatedAt,
        accountName: pluggyAccounts.name,
        connectorName: pluggyItems.connectorName,
      })
      .from(pluggyTransactions)
      .innerJoin(pluggyAccounts, eq(pluggyTransactions.accountId, pluggyAccounts.id))
      .innerJoin(pluggyItems, eq(pluggyAccounts.itemId, pluggyItems.id))
      .where(and(...conditions))
      .orderBy(desc(pluggyTransactions.date), desc(pluggyTransactions.createdAt), desc(pluggyTransactions.id));

    if (params.limit !== undefined) {
      query = query.limit(params.limit) as typeof query;
    }
    if (params.offset !== undefined) {
      query = query.offset(params.offset) as typeof query;
    }

    const rows = await query;
    return { transactions: rows, total };
  }

  async getFinancialSummary(
    params: FinancialSummaryParams,
    tx?: TransactionContext,
  ): Promise<CurrencyFinancialSummary[]> {
    const db = this.getDb(tx);

    const conditions = [eq(pluggyItems.userId, params.userId)];
    if (params.accountId) {
      conditions.push(
        or(
          eq(pluggyTransactions.accountId, params.accountId),
          eq(pluggyAccounts.pluggyAccountId, params.accountId),
        )!,
      );
    }
    if (params.from) {
      conditions.push(gte(pluggyTransactions.date, params.from));
    }
    if (params.to) {
      conditions.push(lte(pluggyTransactions.date, params.to));
    }
    if (params.status && params.status !== 'ALL') {
      conditions.push(eq(pluggyTransactions.status, params.status));
    }

    const summaryRows = await db
      .select({
        currencyCode: pluggyTransactions.currencyCode,
        totalInflows: sql<string>`COALESCE(SUM(
          CASE
            WHEN UPPER(${pluggyTransactions.type}) = 'CREDIT' THEN ABS(${pluggyTransactions.amount})
            WHEN UPPER(${pluggyTransactions.type}) = 'DEBIT' THEN 0
            WHEN ${pluggyTransactions.amount} > 0 THEN ${pluggyTransactions.amount}
            ELSE 0
          END
        ), 0)::text`,
        totalOutflows: sql<string>`COALESCE(SUM(
          CASE
            WHEN UPPER(${pluggyTransactions.type}) = 'DEBIT' THEN ABS(${pluggyTransactions.amount})
            WHEN UPPER(${pluggyTransactions.type}) = 'CREDIT' THEN 0
            WHEN ${pluggyTransactions.amount} < 0 THEN ABS(${pluggyTransactions.amount})
            ELSE 0
          END
        ), 0)::text`,
        netBalance: sql<string>`COALESCE(SUM(
          CASE
            WHEN UPPER(${pluggyTransactions.type}) = 'CREDIT' THEN ABS(${pluggyTransactions.amount})
            WHEN UPPER(${pluggyTransactions.type}) = 'DEBIT' THEN -ABS(${pluggyTransactions.amount})
            WHEN ${pluggyTransactions.amount} > 0 THEN ${pluggyTransactions.amount}
            ELSE ${pluggyTransactions.amount}
          END
        ), 0)::text`,
        transactionCount: sql<number>`CAST(COUNT(*) AS INT)`,
      })
      .from(pluggyTransactions)
      .innerJoin(pluggyAccounts, eq(pluggyTransactions.accountId, pluggyAccounts.id))
      .innerJoin(pluggyItems, eq(pluggyAccounts.itemId, pluggyItems.id))
      .where(and(...conditions))
      .groupBy(pluggyTransactions.currencyCode)
      .orderBy(sql`(${pluggyTransactions.currencyCode} = 'BRL') DESC`, desc(sql`COUNT(*)`));

    // Authoritative balance read directly from pluggy_accounts, grouped by coalesced currency
    const currencyExpr = sql<string>`COALESCE(${pluggyAccounts.currencyCode}, 'BRL')`;
    const accountBalanceRows = await db
      .select({
        currencyCode: currencyExpr,
        totalBalance: sql<string>`COALESCE(SUM(${pluggyAccounts.balance}), 0)::text`,
      })
      .from(pluggyAccounts)
      .innerJoin(pluggyItems, eq(pluggyAccounts.itemId, pluggyItems.id))
      .where(
        and(
          eq(pluggyItems.userId, params.userId),
          params.accountId
            ? or(
                eq(pluggyAccounts.id, params.accountId),
                eq(pluggyAccounts.pluggyAccountId, params.accountId),
              )
            : undefined,
        ),
      )
      .groupBy(currencyExpr);

    const balancesByCurrency = new Map<string, string>();
    for (const row of accountBalanceRows) {
      balancesByCurrency.set(row.currencyCode, row.totalBalance);
    }

    if (summaryRows.length === 0) {
      const defaultBalance = balancesByCurrency.get('BRL') ?? null;
      return [{
        currencyCode: 'BRL',
        totalInflows: '0',
        totalOutflows: '0',
        netBalance: '0',
        transactionCount: 0,
        closingBalance: defaultBalance,
      }];
    }

    return summaryRows.map(row => ({
      currencyCode: row.currencyCode,
      totalInflows: row.totalInflows,
      totalOutflows: row.totalOutflows,
      netBalance: row.netBalance,
      transactionCount: row.transactionCount,
      closingBalance: balancesByCurrency.get(row.currencyCode) ?? null,
    }));
  }

  async upsertMany(
    transactions: NewTransaction[],
    tx?: TransactionContext,
  ): Promise<void> {
    if (transactions.length === 0) {
      return;
    }

    const db = this.getDb(tx);

    // Um único statement tem teto de 65535 bind params no protocolo do Postgres; com ~12
    // colunas por linha isso limita cada INSERT a pouco mais de 5 mil transações.
    const CHUNK_SIZE = 1000;
    const statements = [];

    for (let i = 0; i < transactions.length; i += CHUNK_SIZE) {
      statements.push(this.buildUpsert(db, transactions.slice(i, i + CHUNK_SIZE)));
    }

    // O driver é o neon-http, que não suporta transação interativa (`db.transaction()` lança
    // sempre). O `db.batch()` é o equivalente disponível: manda os statements numa única
    // transação HTTP da Neon, então ou todos os chunks entram ou nenhum entra.
    if (statements.length === 1 || tx) {
      for (const statement of statements) {
        await statement;
      }
      return;
    }

    await this.connection.db.batch(
      statements as unknown as Parameters<DbClient['batch']>[0],
    );
  }

  private buildUpsert(db: DbClient | DbTransaction, chunk: NewTransaction[]) {
    return db
      .insert(pluggyTransactions)
      .values(chunk as NewPluggyTransaction[])
      .onConflictDoUpdate({
        target: pluggyTransactions.pluggyTransactionId,
        set: {
          accountId: sql`excluded.account_id`,
          description: sql`excluded.description`,
          amount: sql`excluded.amount`,
          currencyCode: sql`excluded.currency_code`,
          date: sql`excluded.date`,
          category: sql`excluded.category`,
          categoryId: sql`excluded.category_id`,
          type: sql`excluded.type`,
          status: sql`excluded.status`,
          balance: sql`excluded.balance`,
          raw: sql`excluded.raw`,
          updatedAt: sql`now()`,
        },
        // Sem este predicado toda ressincronização reescreveria o `raw` (jsonb grande, vai
        // para TOAST) de linhas idênticas, gerando bloat e churn de índice à toa.
        setWhere: sql`
          ${pluggyTransactions.amount} IS DISTINCT FROM excluded.amount OR
          ${pluggyTransactions.status} IS DISTINCT FROM excluded.status OR
          ${pluggyTransactions.balance} IS DISTINCT FROM excluded.balance OR
          ${pluggyTransactions.date} IS DISTINCT FROM excluded.date OR
          ${pluggyTransactions.description} IS DISTINCT FROM excluded.description OR
          ${pluggyTransactions.category} IS DISTINCT FROM excluded.category OR
          ${pluggyTransactions.categoryId} IS DISTINCT FROM excluded.category_id OR
          ${pluggyTransactions.type} IS DISTINCT FROM excluded.type
        `,
      });
  }
}
