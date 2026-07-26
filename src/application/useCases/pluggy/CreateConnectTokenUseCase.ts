import { PluggyGateway } from '@application/contracts/PluggyGateway.js';

export class CreateConnectTokenUseCase {
  static inject = [PluggyGateway];

  constructor(private readonly pluggyGateway: PluggyGateway) {}

  async execute(input: CreateConnectTokenUseCase.Input): Promise<CreateConnectTokenUseCase.Output> {
    const { accessToken } = await this.pluggyGateway.createConnectToken({
      clientUserId: input.clientUserId,
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
