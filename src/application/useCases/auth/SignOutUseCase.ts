import { RefreshTokensRepository } from '@infra/database/drizzle/repositories/RefreshTokensRepository.js';
import { UnitOfWork } from '@application/contracts/UnitOfWork.js';
import { TokenService } from '@infra/security/TokenService.js';

export class SignOutUseCase {
  static inject = [
    RefreshTokensRepository,
    UnitOfWork,
    TokenService,
  ];

  constructor(
    private readonly refreshTokensRepository: RefreshTokensRepository,
    private readonly unitOfWork: UnitOfWork,
    private readonly tokenService: TokenService,
  ) {}

  async execute(input: SignOutUseCase.Input): Promise<void> {
    return this.unitOfWork.runInTransaction(async (tx) => {
      const receivedTokenHash = this.tokenService.hashRefreshToken(input.refreshToken);
      const existingToken = await this.refreshTokensRepository.findByHash(receivedTokenHash, tx);

      if (existingToken) {
        await this.refreshTokensRepository.revokeFamily(existingToken.familyId, tx);
      }
    });
  }
}

export namespace SignOutUseCase {
  export type Input = {
    refreshToken: string;
  };
}
