import { describe, it, expect, beforeEach } from 'vitest';
import crypto from 'node:crypto';
import { SignUpUseCase } from './SignUpUseCase.js';
import { SignInUseCase } from './SignInUseCase.js';
import { RefreshTokenUseCase } from './RefreshTokenUseCase.js';
import { SignOutUseCase } from './SignOutUseCase.js';
import { GetMeUseCase } from './GetMeUseCase.js';
import { PurgeExpiredRefreshTokensUseCase } from './PurgeExpiredRefreshTokensUseCase.js';
import { PasswordHasher } from '@infra/security/PasswordHasher.js';
import { TokenService } from '@infra/security/TokenService.js';
import { AppConfig } from '@shared/config/AppConfig.js';
import { User, NewUser } from '@infra/database/drizzle/schemas/users.js';
import { RefreshToken, NewRefreshToken } from '@infra/database/drizzle/schemas/refreshTokens.js';
import { EmailAlreadyInUseError } from '@application/errors/EmailAlreadyInUseError.js';
import { InvalidCredentialsError } from '@application/errors/InvalidCredentialsError.js';
import { InvalidRefreshTokenError } from '@application/errors/InvalidRefreshTokenError.js';
import { UserNotFoundError } from '@application/errors/UserNotFoundError.js';

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

  async findById(id: string): Promise<RefreshToken | null> {
    const token = this.tokensList.find((t) => t.id === id);
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

  async deleteExpiredBefore(cutoff: Date): Promise<number> {
    const before = this.tokensList.length;
    this.tokensList = this.tokensList.filter((token) => token.expiresAt >= cutoff);
    return before - this.tokensList.length;
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
  let getMeUseCase: GetMeUseCase;
  let purgeExpiredRefreshTokensUseCase: PurgeExpiredRefreshTokensUseCase;

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
        refreshTokenGracePeriodMs: 10000,
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
      config,
    );

    signOutUseCase = new SignOutUseCase(
      refreshTokensRepository as any,
      unitOfWork as any,
      tokenService,
    );

    getMeUseCase = new GetMeUseCase(
      usersRepository as any,
    );

    purgeExpiredRefreshTokensUseCase = new PurgeExpiredRefreshTokensUseCase(
      refreshTokensRepository as any,
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
          email: 'TEST@example.com ',
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

      for (let i = 0; i < 4; i++) {
        await expect(signInUseCase.execute({ email, password: 'wrong' })).rejects.toThrow(InvalidCredentialsError);
      }

      await expect(signInUseCase.execute({ email, password: 'wrong' })).rejects.toThrow(InvalidCredentialsError);

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

  describe('GetMeUseCase', () => {
    it('should return user profile by userId', async () => {
      await signUpUseCase.execute({
        name: 'Matheus Dias',
        email: 'matheus@example.com',
        password: 'securePassword123',
      });

      const user = await usersRepository.findByEmail('matheus@example.com');
      const profile = await getMeUseCase.execute({ userId: user!.id });

      expect(profile.id).toBe(user!.id);
      expect(profile.name).toBe('Matheus Dias');
      expect(profile.email).toBe('matheus@example.com');
    });

    it('should throw UserNotFoundError if user is not found', async () => {
      await expect(
        getMeUseCase.execute({ userId: crypto.randomUUID() }),
      ).rejects.toThrow(UserNotFoundError);
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

    it('should allow concurrent replays within 10s grace period while preserving original revokedAt timestamp', async () => {
      // 1st rotation (initial rotation)
      await refreshTokenUseCase.execute({
        refreshToken: initialRefreshToken,
      });

      const initialHash = tokenService.hashRefreshToken(initialRefreshToken);
      const initialInDb = await refreshTokensRepository.findByHash(initialHash);
      const firstRevokedAt = initialInDb?.revokedAt?.getTime();
      expect(firstRevokedAt).toBeDefined();

      // Replay #1 within grace period
      await refreshTokenUseCase.execute({
        refreshToken: initialRefreshToken,
      });

      // Replay #2 within grace period
      await refreshTokenUseCase.execute({
        refreshToken: initialRefreshToken,
      });

      // Replay #3 within grace period
      const replay3Result = await refreshTokenUseCase.execute({
        refreshToken: initialRefreshToken,
      });

      expect(replay3Result.accessToken).toBeDefined();
      expect(replay3Result.refreshToken).toBeDefined();

      // Verify original revokedAt timestamp was NOT overwritten by replays
      expect(initialInDb?.revokedAt?.getTime()).toBe(firstRevokedAt);

      // Now simulate 11 seconds elapsed since initial rotation: grace period is expired!
      if (initialInDb) {
        initialInDb.revokedAt = new Date(Date.now() - 11_000);
      }

      // Replay #4 after grace period expires MUST fail and revoke family
      await expect(
        refreshTokenUseCase.execute({
          refreshToken: initialRefreshToken,
        }),
      ).rejects.toThrow(InvalidRefreshTokenError);
    });

    it('should revoke entire token family on reuse outside grace period (> 10s)', async () => {
      const rotation1 = await refreshTokenUseCase.execute({
        refreshToken: initialRefreshToken,
      });

      // Simulate initialRefreshToken revoked 15 seconds ago
      const initialHash = tokenService.hashRefreshToken(initialRefreshToken);
      const initialInDb = await refreshTokensRepository.findByHash(initialHash);
      if (initialInDb) {
        initialInDb.revokedAt = new Date(Date.now() - 15_000);
      }

      await expect(
        refreshTokenUseCase.execute({
          refreshToken: initialRefreshToken,
        }),
      ).rejects.toThrow(InvalidRefreshTokenError);

      const rotation1Hash = tokenService.hashRefreshToken(rotation1.refreshToken);
      const rotation1InDb = await refreshTokensRepository.findByHash(rotation1Hash);
      expect(rotation1InDb?.revokedAt).toBeDefined();
    });

    it('should revoke family on signout', async () => {
      await signOutUseCase.execute({
        refreshToken: initialRefreshToken,
      });

      await expect(
        refreshTokenUseCase.execute({
          refreshToken: initialRefreshToken,
        }),
      ).rejects.toThrow(InvalidRefreshTokenError);
    });

    it('should not let a rotated token revive a session through the grace period after signout', async () => {
      const rotation = await refreshTokenUseCase.execute({
        refreshToken: initialRefreshToken,
      });

      await signOutUseCase.execute({
        refreshToken: rotation.refreshToken,
      });

      // initialRefreshToken is revoked, has a replacement and sits inside the grace window, but the
      // replacement is dead: signout must win over the grace period.
      await expect(
        refreshTokenUseCase.execute({
          refreshToken: initialRefreshToken,
        }),
      ).rejects.toThrow(InvalidRefreshTokenError);
    });

    it('should keep rejecting a replayed token after reuse detection revoked the family', async () => {
      await refreshTokenUseCase.execute({
        refreshToken: initialRefreshToken,
      });

      const initialHash = tokenService.hashRefreshToken(initialRefreshToken);
      const initialInDb = await refreshTokensRepository.findByHash(initialHash);
      if (initialInDb) {
        initialInDb.revokedAt = new Date(Date.now() - 15_000);
      }

      await expect(
        refreshTokenUseCase.execute({ refreshToken: initialRefreshToken }),
      ).rejects.toThrow(InvalidRefreshTokenError);

      // revokeFamily restamps revokedAt, which used to reopen the grace window on the next replay.
      await expect(
        refreshTokenUseCase.execute({ refreshToken: initialRefreshToken }),
      ).rejects.toThrow(InvalidRefreshTokenError);
    });
  });

  describe('PurgeExpiredRefreshTokensUseCase', () => {
    async function seedToken(expiresAt: Date, revokedAt: Date | null = null) {
      return refreshTokensRepository.create({
        userId: crypto.randomUUID(),
        tokenHash: crypto.randomUUID(),
        familyId: crypto.randomUUID(),
        expiresAt,
        revokedAt,
      });
    }

    it('should delete expired tokens and report how many were removed', async () => {
      await seedToken(new Date(Date.now() - 1_000));
      await seedToken(new Date(Date.now() - 60_000));
      const valid = await seedToken(new Date(Date.now() + 60_000));

      const result = await purgeExpiredRefreshTokensUseCase.execute();

      expect(result.deletedCount).toBe(2);
      expect(refreshTokensRepository.tokensList).toHaveLength(1);
      expect(refreshTokensRepository.tokensList[0].id).toBe(valid.id);
    });

    it('should keep revoked tokens that have not expired yet, so reuse detection still works', async () => {
      const revokedButValid = await seedToken(new Date(Date.now() + 60_000), new Date());

      const result = await purgeExpiredRefreshTokensUseCase.execute();

      expect(result.deletedCount).toBe(0);
      expect(await refreshTokensRepository.findByHash(revokedButValid.tokenHash)).not.toBeNull();
    });

    it('should report zero when there is nothing to purge', async () => {
      await seedToken(new Date(Date.now() + 60_000));

      const result = await purgeExpiredRefreshTokensUseCase.execute();

      expect(result.deletedCount).toBe(0);
    });
  });
});
