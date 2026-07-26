import { describe, it, expect, beforeEach } from 'vitest';
import { CreateConnectTokenUseCase } from './CreateConnectTokenUseCase.js';
import { PluggyGateway } from '@application/contracts/PluggyGateway.js';

class FakePluggyGateway extends PluggyGateway {
  public calls: PluggyGateway.CreateConnectTokenInput[] = [];
  public accessTokenToReturn = 'fake-access-token';

  override async createConnectToken(
    input: PluggyGateway.CreateConnectTokenInput,
  ): Promise<PluggyGateway.CreateConnectTokenOutput> {
    this.calls.push(input);
    return { accessToken: this.accessTokenToReturn };
  }
}

describe('CreateConnectTokenUseCase', () => {
  let gateway: FakePluggyGateway;
  let useCase: CreateConnectTokenUseCase;

  beforeEach(() => {
    gateway = new FakePluggyGateway();
    useCase = new CreateConnectTokenUseCase(gateway);
  });

  it('returns the access token issued by the gateway', async () => {
    const result = await useCase.execute({ clientUserId: 'user-123' });

    expect(result).toEqual({ accessToken: 'fake-access-token' });
  });

  it('forwards the authenticated user id as clientUserId', async () => {
    await useCase.execute({ clientUserId: 'user-123' });

    expect(gateway.calls).toHaveLength(1);
    expect(gateway.calls[0]).toEqual({ clientUserId: 'user-123' });
  });
});
