import { describe, it, expect, vi } from 'vitest';
import { authRoutes } from '@main/routes/auth.js';
import { UsersRepository } from '@infra/database/drizzle/repositories/UsersRepository.js';
import { RefreshTokensRepository } from '@infra/database/drizzle/repositories/RefreshTokensRepository.js';

describe('Handler Hono API - Auth Endpoints', () => {
  it('should return 201 on signup', async () => {
    const findByEmailSpy = vi.spyOn(UsersRepository.prototype, 'findByEmail').mockResolvedValue(null);
    const createUserSpy = vi.spyOn(UsersRepository.prototype, 'create').mockResolvedValue({
      id: 'user-uuid',
      name: 'Matheus',
      email: 'test@example.com',
      passwordHash: 'hashed',
      termsAcceptedAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
      emailVerifiedAt: null,
      failedLoginAttempts: 0,
      lockedUntil: null,
    });
    const createTokenSpy = vi.spyOn(RefreshTokensRepository.prototype, 'create').mockResolvedValue({
      id: 'token-uuid',
      userId: 'user-uuid',
      tokenHash: 'hash',
      familyId: 'family-uuid',
      expiresAt: new Date(),
      revokedAt: null,
      replacedByTokenId: null,
      createdAt: new Date(),
    });

    const res = await authRoutes.request('/auth/signup', {
      method: 'POST',
      body: JSON.stringify({
        name: 'Matheus',
        email: 'test@example.com',
        password: 'securePassword123',
        acceptedTerms: true,
      }),
      headers: {
        'content-type': 'application/json',
      },
    });

    expect(res.status).toBe(201);
    const body = await res.json() as { accessToken: string; refreshToken: string };
    expect(body.accessToken).toBeDefined();
    expect(body.refreshToken).toBeDefined();

    findByEmailSpy.mockRestore();
    createUserSpy.mockRestore();
    createTokenSpy.mockRestore();
  });

  it('should return 400 when signup validation fails', async () => {
    const res = await authRoutes.request('/auth/signup', {
      method: 'POST',
      body: JSON.stringify({
        name: '',
        email: 'invalid-email',
        password: 'short',
        acceptedTerms: false,
      }),
      headers: {
        'content-type': 'application/json',
      },
    });

    expect(res.status).toBe(400);
    const body = await res.json() as { code: string };
    expect(body.code).toBe('VALIDATION');
  });
});
