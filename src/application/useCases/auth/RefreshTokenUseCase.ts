import { UnitOfWork, TransactionContext } from '@application/contracts/UnitOfWork.js';
import { InvalidRefreshTokenError } from '@application/errors/InvalidRefreshTokenError.js';
import { RefreshTokensRepository } from '@infra/database/drizzle/repositories/RefreshTokensRepository.js';
import { TokenService } from '@infra/security/TokenService.js';
import { AppConfig } from '@shared/config/AppConfig.js';
import { RefreshToken } from '@application/entities/RefreshToken.js';

export class RefreshTokenUseCase {
  static inject = [
    RefreshTokensRepository,
    UnitOfWork,
    TokenService,
    AppConfig,
  ];

  constructor(
    private readonly refreshTokensRepository: RefreshTokensRepository,
    private readonly unitOfWork: UnitOfWork,
    private readonly tokenService: TokenService,
    private readonly config: AppConfig,
  ) { }

  async execute(input: RefreshTokenUseCase.Input): Promise<RefreshTokenUseCase.Output> {
    return this.unitOfWork.runInTransaction(async (tx) => {
      const receivedTokenHash = this.tokenService.hashRefreshToken(input.refreshToken);
      const rawToken = await this.refreshTokensRepository.findByHash(receivedTokenHash, tx);

      if (!rawToken) {
        throw new InvalidRefreshTokenError();
      }

      const existingToken = new RefreshToken(rawToken);

      // Reuse detection with Grace Period for concurrent requests
      if (existingToken.isRevoked()) {
        const gracePeriodMs = this.config.auth.refreshTokenGracePeriodMs;

        if (!existingToken.isExpired() && existingToken.isWithinGracePeriod(gracePeriodMs)) {
          const replacement = await this.findReplacement(existingToken, tx);

          // The grace period only covers requests racing a live rotation. A missing or already
          // revoked replacement means the family was killed by signout or by reuse detection, and
          // re-issuing here would silently undo that.
          if (replacement && !replacement.isRevoked()) {
            const { token: newRefreshToken, tokenHash: newRefreshTokenHash, expiresAt: newExpiresAt } =
              this.tokenService.generateRefreshToken();

            await this.refreshTokensRepository.create({
              userId: existingToken.userId,
              tokenHash: newRefreshTokenHash,
              familyId: existingToken.familyId,
              expiresAt: newExpiresAt,
            }, tx);

            // Do NOT re-revoke existingToken here to preserve original revokedAt timestamp and close grace period window on schedule
            const accessToken = await this.tokenService.issueAccessToken(existingToken.userId);

            return {
              accessToken,
              refreshToken: newRefreshToken,
            };
          }
        }

        await this.refreshTokensRepository.revokeFamily(existingToken.familyId, tx);
        // eslint-disable-next-line no-console
        console.warn(`[SECURITY WARNING] Refresh token reuse detected for family ${existingToken.familyId}. Revoking family.`);
        throw new InvalidRefreshTokenError();
      }

      if (existingToken.isExpired()) {
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

  private async findReplacement(token: RefreshToken, tx?: TransactionContext): Promise<RefreshToken | null> {
    if (!token.replacedByTokenId) {
      return null;
    }

    const rawReplacement = await this.refreshTokensRepository.findById(token.replacedByTokenId, tx);
    return rawReplacement ? new RefreshToken(rawReplacement) : null;
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
