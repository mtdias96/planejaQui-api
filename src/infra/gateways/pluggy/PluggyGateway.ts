import { PluggyClient } from '@infra/clients/pluggy/PluggyClient.js';

export class PluggyGateway {
  static inject = [PluggyClient];

  private static readonly MAX_PAGES = 10;

  constructor(private readonly client: PluggyClient) {}

  async createConnectToken({
    clientUserId,
    webhookUrl,
    itemId,
  }: PluggyGateway.CreateConnectTokenParams): Promise<PluggyGateway.CreateConnectTokenResult> {
    const data = await this.client.post<PluggyGateway.RawConnectTokenResponse>('/connect_token', {
      ...(itemId ? { itemId } : {}),
      options: {
        clientUserId,
        ...(webhookUrl ? { webhookUrl } : {}),
      },
    });

    return {
      accessToken: data.accessToken,
    };
  }

  async listAccounts({
    itemId,
  }: PluggyGateway.ListAccountsParams): Promise<PluggyGateway.ListAccountsResult> {
    const accounts: PluggyGateway.Account[] = [];
    let page = 1;
    let totalPages: number;

    do {
      const response = await this.client.get<PluggyGateway.RawPaginatedResponse<PluggyGateway.RawAccount>>(
        '/accounts',
        { itemId, page: String(page) },
      );

      for (const raw of response.results ?? []) {
        accounts.push({
          id: raw.id,
          type: raw.type,
          subtype: raw.subtype,
          name: raw.name,
          marketingName: raw.marketingName ?? null,
          number: raw.number ?? null,
          balance: raw.balance ?? 0,
          currencyCode: raw.currencyCode ?? 'BRL',
          owner: raw.owner ?? null,
          taxNumber: raw.taxNumber ?? null,
          raw,
        });
      }

      totalPages = response.totalPages ?? 1;
      page += 1;
    } while (page <= totalPages && page <= PluggyGateway.MAX_PAGES);

    return { accounts };
  }

  async listTransactions({
    accountId,
  }: PluggyGateway.ListTransactionsParams): Promise<PluggyGateway.ListTransactionsResult> {
    const transactions: PluggyGateway.Transaction[] = [];
    let cursor: string | undefined;
    let pageCount = 0;

    do {
      const response = await this.client.get<PluggyGateway.RawCursoredResponse<PluggyGateway.RawTransaction>>(
        '/v2/transactions',
        {
          accountId,
          ...(cursor ? { after: cursor } : {}),
        },
      );

      for (const raw of response.results ?? []) {
        transactions.push({
          id: raw.id,
          description: raw.description,
          amount: raw.amount,
          currencyCode: raw.currencyCode ?? 'BRL',
          date: new Date(raw.date),
          category: raw.category ?? null,
          categoryId: raw.categoryId ?? null,
          type: raw.type,
          status: raw.status,
          raw,
        });
      }

      cursor = this.extractCursor(response.next);
      pageCount += 1;
    } while (cursor && pageCount < PluggyGateway.MAX_PAGES);

    return { transactions };
  }

  async getItem({
    itemId,
  }: PluggyGateway.GetItemParams): Promise<PluggyGateway.GetItemResult> {
    const raw = await this.client.get<PluggyGateway.RawItem>(`/items/${itemId}`);

    return {
      item: {
        id: raw.id,
        connectorId: raw.connector.id,
        connectorName: raw.connector.name,
        status: raw.status,
        executionStatus: raw.executionStatus,
        lastSyncedAt: raw.lastUpdatedAt ? new Date(raw.lastUpdatedAt) : null,
      },
    };
  }

  private extractCursor(next: string | null): string | undefined {
    if (!next) {
      return undefined;
    }
    const queryString = next.includes('?') ? next.split('?')[1] : next;
    return new URLSearchParams(queryString).get('after') ?? undefined;
  }
}

export namespace PluggyGateway {
  // Contratos de Parâmetros e Resultados (Padrão AWS Gateway)
  export type CreateConnectTokenParams = {
    clientUserId: string;
    webhookUrl?: string;
    itemId?: string;
  };

  export type CreateConnectTokenResult = {
    accessToken: string;
  };

  export type ListAccountsParams = {
    itemId: string;
  };

  export type Account = {
    id: string;
    type: string;
    subtype: string;
    name: string;
    marketingName: string | null;
    number: string | null;
    balance: number;
    currencyCode: string;
    owner: string | null;
    taxNumber: string | null;
    raw: Record<string, unknown>;
  };

  export type ListAccountsResult = {
    accounts: Account[];
  };

  export type ListTransactionsParams = {
    accountId: string;
  };

  export type Transaction = {
    id: string;
    description: string;
    amount: number;
    currencyCode: string;
    date: Date;
    category: string | null;
    categoryId: string | null;
    type: string;
    status: string;
    raw: Record<string, unknown>;
  };

  export type ListTransactionsResult = {
    transactions: Transaction[];
  };

  export type GetItemParams = {
    itemId: string;
  };

  export type Item = {
    id: string;
    connectorId: number;
    connectorName: string;
    status: string;
    executionStatus: string;
    lastSyncedAt: Date | null;
  };

  export type GetItemResult = {
    item: Item;
  };

  // Tipos internos de resposta da API Pluggy
  export type RawConnectTokenResponse = {
    accessToken: string;
  };

  export type RawPaginatedResponse<T> = {
    page: number;
    totalPages: number;
    total: number;
    results: T[];
  };

  export type RawCursoredResponse<T> = {
    results: T[];
    next: string | null;
  };

  export type RawAccount = {
    id: string;
    type: string;
    subtype: string;
    name: string;
    marketingName?: string | null;
    number?: string | null;
    balance: number;
    currencyCode: string;
    owner?: string | null;
    taxNumber?: string | null;
  } & Record<string, unknown>;

  export type RawTransaction = {
    id: string;
    description: string;
    amount: number;
    currencyCode: string;
    date: string;
    category?: string | null;
    categoryId?: string | null;
    type: string;
    status: string;
  } & Record<string, unknown>;

  export type RawItem = {
    id: string;
    connector: { id: number; name: string };
    status: string;
    executionStatus: string;
    lastUpdatedAt?: string | null;
  };
}
