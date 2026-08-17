import { PluggyGateway } from '@infra/gateways/pluggy/PluggyGateway.js';
import { PluggyItemsRepository } from '@infra/database/drizzle/repositories/PluggyItemsRepository.js';
import { PluggyAccountsRepository } from '@infra/database/drizzle/repositories/PluggyAccountsRepository.js';

export class ListAccountsUseCase {
  static inject = [PluggyGateway, PluggyItemsRepository, PluggyAccountsRepository];

  constructor(
    private readonly pluggyGateway: PluggyGateway,
    private readonly pluggyItemsRepository: PluggyItemsRepository,
    private readonly pluggyAccountsRepository: PluggyAccountsRepository,
  ) {}

  async execute(input: ListAccountsUseCase.Input): Promise<ListAccountsUseCase.Output> {
    const items = await this.pluggyItemsRepository.findByUserId(input.userId);

    const accounts: ListAccountsUseCase.Account[] = [];

    for (const item of items) {
      const { accounts: fetched } = await this.pluggyGateway.listAccounts({
        itemId: item.pluggyItemId,
      });

      await this.pluggyAccountsRepository.upsertMany(
        fetched.map(account => ({
          itemId: item.id,
          pluggyAccountId: account.id,
          type: account.type,
          subtype: account.subtype,
          name: account.name,
          marketingName: account.marketingName,
          number: account.number,
          balance: account.balance === null ? null : String(account.balance),
          currencyCode: account.currencyCode,
          owner: account.owner,
          taxNumber: account.taxNumber,
          raw: account.raw,
        })),
      );

      await this.pluggyItemsRepository.touchSyncedAt(item.id);

      accounts.push(...fetched.map(account => Object.assign(account, {
        connectorName: item.connectorName,
        itemStatus: item.status,
      })));
    }

    return { accounts };
  }
}

export namespace ListAccountsUseCase {
  export type Input = {
    userId: string;
  };

  export type Account = PluggyGateway.Account & {
    connectorName: string | null;
    itemStatus: string | null;
  };

  export type Output = {
    accounts: Account[];
  };
}
