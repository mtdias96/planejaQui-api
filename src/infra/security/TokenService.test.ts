import { describe, it, expect } from 'vitest';
import { TokenService } from './TokenService.js';
import { AppConfig } from '@shared/config/AppConfig.js';

describe('TokenService', () => {
  const config = new AppConfig();
  // Override auth configuration for testing
  Object.defineProperty(config, 'auth', {
    value: {
      jwtSecret: 'super_secret_key_at_least_32_characters_long_for_test',
      accessTokenTtl: '1s',
      refreshTokenTtlDays: 30,
    },
    writable: false,
  });

  const tokenService = new TokenService(config);

  it('should sign and verify access token successfully', async () => {
    const userId = 'user-123';
    const token = await tokenService.issueAccessToken(userId);

    expect(token).toBeDefined();

    const payload = await tokenService.verifyAccessToken(token);
    expect(payload.userId).toBe(userId);
  });

  it('should reject expired access token', async () => {
    const userId = 'user-123';
    const token = await tokenService.issueAccessToken(userId);

    // Wait 1.1s for expiration
    await new Promise((resolve) => setTimeout(resolve, 1100));

    await expect(tokenService.verifyAccessToken(token)).rejects.toThrow();
  });

  it('should generate stable hashes for refresh tokens', () => {
    const { token, tokenHash } = tokenService.generateRefreshToken();

    expect(token).toBeDefined();
    expect(tokenHash).toBeDefined();

    const secondHash = tokenService.hashRefreshToken(token);
    expect(secondHash).toBe(tokenHash);
  });
});
