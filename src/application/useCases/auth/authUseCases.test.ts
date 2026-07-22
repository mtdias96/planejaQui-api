import { describe, it, expect, beforeEach } from 'vitest';
import crypto from 'node:crypto';
import { SignUpUseCase } from './SignUpUseCase.js';
import { SignInUseCase } from './SignInUseCase.js';
import { RefreshTokenUseCase } from './RefreshTokenUseCase.js';
import { SignOutUseCase } from './SignOutUseCase.js';
import { PasswordHasher } from '@infra/security/PasswordHasher.js';
import { TokenService } from '@infra/security/TokenService.js';
import { AppConfig } from '@shared/config/AppConfig.js';
import { User, NewUser } from '@infra/database/drizzle/schemas/users.js';
import { RefreshToken, NewRefreshToken } from '@infra/database/drizzle/schemas/refreshTokens.js';
import { EmailAlreadyInUseError } from '@application/errors/EmailAlreadyInUseError.js';
import { InvalidCredentialsError } from '@application/errors/InvalidCredentialsError.js';
import { InvalidRefreshTokenError } from '@application/errors/InvalidRefreshTokenError.js';

class FakeUsersRepository {
  public usersList: User[] = [];

  async findByEmail(email: string): Promise<User | null> {
    const user = this.usersList.find((u) => u.email === email.toLowerCase().trim());
    return user ?? null;
  }

  async findById(id: string): Promise<User | null> {
    const user = this.usersList.find((u) => u.id === id);
    return user ?? null;
  }

  async create(data: NewUser): Promise<User> {
    const newUser: User = {
      id: crypto.randomUUID(),
      name: data.name,
      email: data.email,
      passwordHash: data.passwordHash,
      emailVerifiedAt: data.emailVerifiedAt ?? null,
      termsAcceptedAt: data.termsAcceptedAt,
      failedLoginAttempts: 0,
      lockedUntil: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.usersList.push(newUser);
    return newUser;
  }

  async incrementFailedLogin(id: string): Promise<void> {
    const user = this.usersList.find((u) => u.id === id);
    if (user) {
      user.failedLoginAttempts += 1;
      if (user.failedLoginAttempts >= 5) {
        user.lockedUntil = new Date(Date.now() + 15 * 60 * 1000);
      }
    }
  }

  async resetFailedLogin(id: string): Promise<void> {
    const user = this.usersList.find((u) => u.id === id);
    if (user) {
      user.failedLoginAttempts = 0;
      user.lockedUntil = null;
    }
  }

  async touchLogin(id: string): Promise<void> {
    const user = this.usersList.find((u) => u.id === id);
    if (user) {
      user.updatedAt = new Date();
    }
  }
}

class FakeRefreshTokensRepository {
  public tokensList: RefreshToken[] = [];

  async create(data: NewRefreshToken): Promise<RefreshToken> {
    const newToken: RefreshToken = {
      id: crypto.randomUUID(),
      userId: data.userId,
      tokenHash: data.tokenHash,
      familyId: data.familyId,
      expiresAt: data.expiresAt,
      revokedAt: data.revokedAt ?? null,
      replacedByTokenId: data.replacedByTokenId ?? null,
      createdAt: new Date(),
    };
    this.tokensList.push(newToken);
    return newToken;
  }

  async findByHash(tokenHash: string): Promise<RefreshToken | null> {
    const token = this.tokensList.find((t) => t.tokenHash === tokenHash);
    return token ?? null;
  }

  async revoke(id: string, replacedByTokenId?: string): Promise<void> {
    const token = this.tokensList.find((t) => t.id === id);
    if (token) {
      token.revokedAt = new Date();
      token.replacedByTokenId = replacedByTokenId ?? null;
    }
  }

  async revokeFamily(familyId: string): Promise<void> {
    this.tokensList.forEach((token) => {
      if (token.familyId === familyId) {
        token.revokedAt = new Date();
      }
    });
  }
}

class FakeUnitOfWork {
  async runInTransaction<T>(work: (tx?: any) => Promise<T>): Promise<T> {
    return work(null);
  }
}

describe('Auth Use Cases', () => {
  let usersRepository: FakeUsersRepository;
  let refreshTokensRepository: FakeRefreshTokensRepository;
  let unitOfWork: FakeUnitOfWork;
  let passwordHasher: PasswordHasher;
  let tokenService: TokenService;
  let signUpUseCase: SignUpUseCase;
  let signInUseCase: SignInUseCase;
  let refreshTokenUseCase: RefreshTokenUseCase;
  let signOutUseCase: SignOutUseCase;

  beforeEach(() => {
    usersRepository = new FakeUsersRepository();
    refreshTokensRepository = new FakeRefreshTokensRepository();
    unitOfWork = new FakeUnitOfWork();
    passwordHasher = new PasswordHasher();

    const config = new AppConfig();
    Object.defineProperty(config, 'auth', {
      value: {
        jwtSecret: 'super_secret_key_at_least_32_characters_long_for_test',
        accessTokenTtl: '15m',
        refreshTokenTtlDays: 30,
      },
      writable: false,
    });
    tokenService = new TokenService(config);

    signUpUseCase = new SignUpUseCase(
      usersRepository as any,
      refreshTokensRepository as any,
      unitOfWork as any,
      passwordHasher,
      tokenService,
    );

    signInUseCase = new SignInUseCase(
      usersRepository as any,
      refreshTokensRepository as any,
      unitOfWork as any,
      passwordHasher,
      tokenService,
    );

    refreshTokenUseCase = new RefreshTokenUseCase(
      refreshTokensRepository as any,
      unitOfWork as any,
      tokenService,
    );

    signOutUseCase = new SignOutUseCase(
      refreshTokensRepository as any,
      unitOfWork as any,
      tokenService,
    );
  });

  describe('SignUpUseCase', () => {
    it('should successfully sign up a user', async () => {
      const result = await signUpUseCase.execute({
        name: 'Matheus',
        email: 'test@example.com',
        password: 'securePassword123',
      });

      expect(result.accessToken).toBeDefined();
      expect(result.refreshToken).toBeDefined();

      const user = await usersRepository.findByEmail('test@example.com');
      expect(user).toBeDefined();
      expect(user?.name).toBe('Matheus');
      expect(user?.passwordHash).not.toBe('securePassword123');
    });

    it('should throw EmailAlreadyInUseError when trying to sign up with an existing email', async () => {
      await signUpUseCase.execute({
        name: 'Matheus',
        email: 'test@example.com',
        password: 'securePassword123',
      });

      await expect(
        signUpUseCase.execute({
          name: 'Another Name',
          email: 'TEST@example.com ', // tests normalization
          password: 'anotherPassword',
        }),
      ).rejects.toThrow(EmailAlreadyInUseError);
    });
  });

  describe('SignInUseCase', () => {
    beforeEach(async () => {
      await signUpUseCase.execute({
        name: 'Matheus',
        email: 'test@example.com',
        password: 'securePassword123',
      });
    });

    it('should login successfully with correct credentials', async () => {
      const result = await signInUseCase.execute({
        email: 'test@example.com',
        password: 'securePassword123',
      });

      expect(result.accessToken).toBeDefined();
      expect(result.refreshToken).toBeDefined();
    });

    it('should throw InvalidCredentialsError for wrong password', async () => {
      await expect(
        signInUseCase.execute({
          email: 'test@example.com',
          password: 'wrongPassword',
        }),
      ).rejects.toThrow(InvalidCredentialsError);
    });

    it('should throw InvalidCredentialsError for non-existent email', async () => {
      await expect(
        signInUseCase.execute({
          email: 'notfound@example.com',
          password: 'securePassword123',
        }),
      ).rejects.toThrow(InvalidCredentialsError);
    });

    it('should lock account after 5 failed login attempts', async () => {
      const email = 'test@example.com';

      // 4 failures
      for (let i = 0; i < 4; i++) {
        await expect(signInUseCase.execute({ email, password: 'wrong' })).rejects.toThrow(InvalidCredentialsError);
      }

      // 5th failure triggers lock
      await expect(signInUseCase.execute({ email, password: 'wrong' })).rejects.toThrow(InvalidCredentialsError);

      // Subsequent attempt even with correct password throws lock error
      const user = await usersRepository.findByEmail(email);
      expect(user?.lockedUntil).toBeDefined();
      expect(user?.failedLoginAttempts).toBe(5);

      await expect(
        signInUseCase.execute({
          email,
          password: 'securePassword123',
        }),
      ).rejects.toThrow(InvalidCredentialsError);
    });
  });

  describe('RefreshTokenUseCase & SignOutUseCase', () => {
    let initialRefreshToken: string;

    beforeEach(async () => {
      const signUpResult = await signUpUseCase.execute({
        name: 'Matheus',
        email: 'test@example.com',
        password: 'securePassword123',
      });
      initialRefreshToken = signUpResult.refreshToken;
    });

    it('should rotate refresh token successfully when valid', async () => {
      const result = await refreshTokenUseCase.execute({
        refreshToken: initialRefreshToken,
      });

      expect(result.accessToken).toBeDefined();
      expect(result.refreshToken).toBeDefined();
      expect(result.refreshToken).not.toBe(initialRefreshToken);

      const oldTokenHash = tokenService.hashRefreshToken(initialRefreshToken);
      const oldTokenInDb = await refreshTokensRepository.findByHash(oldTokenHash);
      expect(oldTokenInDb?.revokedAt).toBeDefined();
      expect(oldTokenInDb?.replacedByTokenId).toBeDefined();
    });

    it('should revoke entire token family and reject rotation on reuse detection', async () => {
      // 1st rotation
      const rotation1 = await refreshTokenUseCase.execute({
        refreshToken: initialRefreshToken,
      });

      // Try to reuse initialRefreshToken again
      await expect(
        refreshTokenUseCase.execute({
          refreshToken: initialRefreshToken,
        }),
      ).rejects.toThrow(InvalidRefreshTokenError);

      // Verify that the new token (rotation1.refreshToken) was also revoked
      const newTokenHash = tokenService.hashRefreshToken(rotation1.refreshToken);
      const newTokenInDb = await refreshTokensRepository.findByHash(newTokenHash);
      expect(newTokenInDb?.revokedAt).toBeDefined();
    });

    it('should revoke family on signout', async () => {
      await signOutUseCase.execute({
        refreshToken: initialRefreshToken,
      });

      // Trying to rotate after signout should fail
      await expect(
        refreshTokenUseCase.execute({
          refreshToken: initialRefreshToken,
        }),
      ).rejects.toThrow(InvalidRefreshTokenError);
    });
  });
});
