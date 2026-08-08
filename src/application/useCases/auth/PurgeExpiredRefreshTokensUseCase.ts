import { RefreshTokensRepository } from '@infra/database/drizzle/repositories/RefreshTokensRepository.js';

export class PurgeExpiredRefreshTokensUseCase {
  static inject = [RefreshTokensRepository];

  constructor(private readonly refreshTokensRepository: RefreshTokensRepository) {}

  async execute(): Promise<PurgeExpiredRefreshTokensUseCase.Output> {
    // A token past expiresAt is already rejected by RefreshToken.isExpired(), so removing it costs
    // nothing. Revoked tokens still inside their TTL are kept on purpose: both reuse detection and
    // the grace period depend on findByHash still resolving them.
    const deletedCount = await this.refreshTokensRepository.deleteExpiredBefore(new Date());

    return { deletedCount };
  }
}

export namespace PurgeExpiredRefreshTokensUseCase {
  export type Output = {
    deletedCount: number;
  };
}
