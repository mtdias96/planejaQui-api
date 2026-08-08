import { describe, it, expect, vi } from 'vitest';
import { authRoutes } from '@main/routes/auth.js';
import { UsersRepository } from '@infra/database/drizzle/repositories/UsersRepository.js';
import { RefreshTokensRepository } from '@infra/database/drizzle/repositories/RefreshTokensRepository.js';
import { TokenService } from '@infra/security/TokenService.js';

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

  it('should return 200 and user profile on GET /auth/me with valid Bearer token', async () => {
    const verifyTokenSpy = vi.spyOn(TokenService.prototype, 'verifyAccessToken').mockResolvedValue({
      userId: 'user-uuid-123',
    });

    const findByIdSpy = vi.spyOn(UsersRepository.prototype, 'findById').mockResolvedValue({
      id: 'user-uuid-123',
      name: 'Matheus Dias',
      email: 'matheus@example.com',
      passwordHash: 'hashed',
      termsAcceptedAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
      emailVerifiedAt: null,
      failedLoginAttempts: 0,
      lockedUntil: null,
    });

    const res = await authRoutes.request('/auth/me', {
      method: 'GET',
      headers: {
        'Authorization': 'Bearer valid-jwt-token',
      },
    });

    expect(res.status).toBe(200);
    const body = await res.json() as { id: string; name: string; email: string; emailVerifiedAt: Date | null };
    expect(body.id).toBe('user-uuid-123');
    expect(body.name).toBe('Matheus Dias');
    expect(body.email).toBe('matheus@example.com');
    expect(body.emailVerifiedAt).toBeNull();

    verifyTokenSpy.mockRestore();
    findByIdSpy.mockRestore();
  });

  it('should return 404 USER_NOT_FOUND when user does not exist on GET /auth/me', async () => {
    const verifyTokenSpy = vi.spyOn(TokenService.prototype, 'verifyAccessToken').mockResolvedValue({
      userId: 'non-existent-user-id',
    });

    const findByIdSpy = vi.spyOn(UsersRepository.prototype, 'findById').mockResolvedValue(null);

    const res = await authRoutes.request('/auth/me', {
      method: 'GET',
      headers: {
        'Authorization': 'Bearer valid-jwt-token',
      },
    });

    expect(res.status).toBe(404);
    const body = await res.json() as { code: string };
    expect(body.code).toBe('USER_NOT_FOUND');

    verifyTokenSpy.mockRestore();
    findByIdSpy.mockRestore();
  });
});
