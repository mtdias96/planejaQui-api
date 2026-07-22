import { UsersRepository } from '@infra/database/drizzle/repositories/UsersRepository.js';
import { RefreshTokensRepository } from '@infra/database/drizzle/repositories/RefreshTokensRepository.js';
import { UnitOfWork } from '@application/contracts/UnitOfWork.js';
import { PasswordHasher } from '@infra/security/PasswordHasher.js';
import { TokenService } from '@infra/security/TokenService.js';
import { EmailAlreadyInUseError } from '@application/errors/EmailAlreadyInUseError.js';
import crypto from 'node:crypto';

export class SignUpUseCase {
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

  async execute(input: SignUpUseCase.Input): Promise<SignUpUseCase.Output> {
    return this.unitOfWork.runInTransaction(async (tx) => {
      const normalizedEmail = input.email.toLowerCase().trim();

      const existingUser = await this.usersRepository.findByEmail(normalizedEmail, tx);
      if (existingUser) {
        throw new EmailAlreadyInUseError();
      }

      const passwordHash = await this.passwordHasher.hash(input.password);
      const user = await this.usersRepository.create({
        name: input.name,
        email: normalizedEmail,
        passwordHash,
        termsAcceptedAt: new Date(),
      }, tx);

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

export namespace SignUpUseCase {
  export type Input = {
    name: string;
    email: string;
    password: string;
    acceptedTerms?: boolean;
  };

  export type Output = {
    accessToken: string;
    refreshToken: string;
  };
}
