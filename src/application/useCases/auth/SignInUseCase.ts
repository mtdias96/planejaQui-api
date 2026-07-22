import { UsersRepository } from '@infra/database/drizzle/repositories/UsersRepository.js';
import { RefreshTokensRepository } from '@infra/database/drizzle/repositories/RefreshTokensRepository.js';
import { UnitOfWork } from '@application/contracts/UnitOfWork.js';
import { PasswordHasher } from '@infra/security/PasswordHasher.js';
import { TokenService } from '@infra/security/TokenService.js';
import { InvalidCredentialsError } from '@application/errors/InvalidCredentialsError.js';
import crypto from 'node:crypto';

const DUMMY_HASH = '$argon2id$v=19$m=19456,t=2,p=1$c29tZXNhbHQ$dGVzdHBhc3N3b3Jk';

export class SignInUseCase {
  static inject = [
    UsersRepository,
    RefreshTokensRepository,
    UnitOfWork,
    PasswordHasher,
    TokenService,
  ];

  constructor(
    private readonly usersRepository: UsersRepository,
    private readonly refreshTokensRepository: RefreshTokensRepository,
    private readonly unitOfWork: UnitOfWork,
    private readonly passwordHasher: PasswordHasher,
    private readonly tokenService: TokenService,
  ) {}

  async execute(input: SignInUseCase.Input): Promise<SignInUseCase.Output> {
    return this.unitOfWork.runInTransaction(async (tx) => {
      const normalizedEmail = input.email.toLowerCase().trim();
      const user = await this.usersRepository.findByEmail(normalizedEmail, tx);

      if (!user) {
        // Timing attack protection
        await this.passwordHasher.verify(DUMMY_HASH, input.password);
        throw new InvalidCredentialsError();
      }

      if (user.lockedUntil && user.lockedUntil > new Date()) {
        throw new InvalidCredentialsError();
      }

      const isValid = await this.passwordHasher.verify(user.passwordHash, input.password);
      if (!isValid) {
        await this.usersRepository.incrementFailedLogin(user.id, tx);
        throw new InvalidCredentialsError();
      }

      await this.usersRepository.resetFailedLogin(user.id, tx);

      const familyId = crypto.randomUUID();
      const { token: refreshToken, tokenHash, expiresAt } = this.tokenService.generateRefreshToken();

      await this.refreshTokensRepository.create({
        userId: user.id,
        tokenHash,
        familyId,
        expiresAt,
      }, tx);

      const accessToken = await this.tokenService.issueAccessToken(user.id);

      return {
        accessToken,
        refreshToken,
      };
    });
  }
}

export namespace SignInUseCase {
  export type Input = {
    email: string;
    password: string;
  };

  export type Output = {
    accessToken: string;
    refreshToken: string;
  };
}
