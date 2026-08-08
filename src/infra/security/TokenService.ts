import { AppConfig } from '@shared/config/AppConfig.js';
import { SignJWT, jwtVerify } from 'jose';
import crypto from 'node:crypto';

export class TokenService {
  static inject = [AppConfig];

  private readonly secret: Uint8Array;
  private readonly accessTokenTtl: string;
  private readonly refreshTokenTtlDays: number;

  constructor(config: AppConfig) {
    this.secret = new TextEncoder().encode(config.auth.jwtSecret);
    this.accessTokenTtl = config.auth.accessTokenTtl;
    this.refreshTokenTtlDays = config.auth.refreshTokenTtlDays;
  }

  async issueAccessToken(userId: string): Promise<string> {
    return new SignJWT({ type: 'access' })
      .setProtectedHeader({ alg: 'HS256' })
      .setSubject(userId)
      .setIssuedAt()
      .setExpirationTime(this.accessTokenTtl)
      .sign(this.secret);
  }

  async verifyAccessToken(token: string): Promise<{ userId: string }> {
    const { payload } = await jwtVerify(token, this.secret, {
      algorithms: ['HS256'],
    });

    if (payload.type !== 'access' || !payload.sub) {
      throw new Error('Invalid token type or subject');
    }

    return { userId: payload.sub };
  }

  generateRefreshToken(): { token: string; tokenHash: string; expiresAt: Date } {
    const token = crypto.randomBytes(32).toString('base64url');
    const tokenHash = this.hashRefreshToken(token);
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + this.refreshTokenTtlDays);
    
    return { token, tokenHash, expiresAt };
  }

  hashRefreshToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
  }
}
