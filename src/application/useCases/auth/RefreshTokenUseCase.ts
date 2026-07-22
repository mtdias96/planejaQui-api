import { UnitOfWork } from '@application/contracts/UnitOfWork.js';
import { InvalidRefreshTokenError } from '@application/errors/InvalidRefreshTokenError.js';
import { RefreshTokensRepository } from '@infra/database/drizzle/repositories/RefreshTokensRepository.js';
import { TokenService } from '@infra/security/TokenService.js';

export class RefreshTokenUseCase {
  static inject = [
    RefreshTokensRepository,
    UnitOfWork,
    TokenService,
  ];

  constructor(
    private readonly refreshTokensRepository: RefreshTokensRepository,
    private readonly unitOfWork: UnitOfWork,
    private readonly tokenService: TokenService,
  ) { }

  async execute(input: RefreshTokenUseCase.Input): Promise<RefreshTokenUseCase.Output> {
    return this.unitOfWork.runInTransaction(async (tx) => {
      const receivedTokenHash = this.tokenService.hashRefreshToken(input.refreshToken);
      const existingToken = await this.refreshTokensRepository.findByHash(receivedTokenHash, tx);

      if (!existingToken) {
        throw new InvalidRefreshTokenError();
      }

      // Reuse detection
      if (existingToken.revokedAt) {
        await this.refreshTokensRepository.revokeFamily(existingToken.familyId, tx);
        // eslint-disable-next-line no-console
        console.warn(`[SECURITY WARNING] Refresh token reuse detected for family ${existingToken.familyId}. Revoking family.`);
        throw new InvalidRefreshTokenError();
      }

      if (existingToken.expiresAt < new Date()) {
        throw new InvalidRefreshTokenError();
      }

      const { token: newRefreshToken, tokenHash: newRefreshTokenHash, expiresAt: newExpiresAt } =
        this.tokenService.generateRefreshToken();

      const newStoredToken = await this.refreshTokensRepository.create({
        userId: existingToken.userId,
        tokenHash: newRefreshTokenHash,
        familyId: existingToken.familyId,
        expiresAt: newExpiresAt,
      }, tx);

      await this.refreshTokensRepository.revoke(existingToken.id, newStoredToken.id, tx);

      const accessToken = await this.tokenService.issueAccessToken(existingToken.userId);

      return {
        accessToken,
        refreshToken: newRefreshToken,
      };
    });
  }
}

export namespace RefreshTokenUseCase {
  export type Input = {
    refreshToken: string;
  };

  export type Output = {
    accessToken: string;
    refreshToken: string;
  };
}
