import { AppConfig } from '@shared/config/AppConfig.js';
import { PluggyGateway } from '@infra/gateways/pluggy/PluggyGateway.js';

export class CreateConnectTokenUseCase {
  static inject = [PluggyGateway, AppConfig];

  constructor(
    private readonly pluggyGateway: PluggyGateway,
    private readonly config: AppConfig,
  ) {}

  async execute(input: CreateConnectTokenUseCase.Input): Promise<CreateConnectTokenUseCase.Output> {
    const { accessToken } = await this.pluggyGateway.createConnectToken({
      clientUserId: input.clientUserId,
      webhookUrl: this.config.pluggy.webhookUrl,
    });

    return { accessToken };
  }
}

export namespace CreateConnectTokenUseCase {
  export type Input = {
    clientUserId: string;
  };

  export type Output = {
    accessToken: string;
  };
}
