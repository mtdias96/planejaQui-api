export abstract class PluggyGateway {
  abstract createConnectToken(
    input: PluggyGateway.CreateConnectTokenInput,
  ): Promise<PluggyGateway.CreateConnectTokenOutput>;
}

export namespace PluggyGateway {
  export type CreateConnectTokenInput = {
    clientUserId?: string;
    webhookUrl?: string;
  };

  export type CreateConnectTokenOutput = {
    accessToken: string;
  };
}
