import crypto from 'node:crypto';

export class RefreshToken {
  readonly id: string;
  readonly userId: string;
  readonly tokenHash: string;
  readonly familyId: string;
  readonly expiresAt: Date;
  readonly createdAt: Date;

  revokedAt: Date | null;
  replacedByTokenId: string | null;

  constructor(attr: RefreshToken.Attributes) {
    this.id = attr.id ?? crypto.randomUUID();
    this.userId = attr.userId;
    this.tokenHash = attr.tokenHash;
    this.familyId = attr.familyId ?? crypto.randomUUID();
    this.expiresAt = attr.expiresAt;
    this.revokedAt = attr.revokedAt ?? null;
    this.replacedByTokenId = attr.replacedByTokenId ?? null;
    this.createdAt = attr.createdAt ?? new Date();
  }

  isRevoked(): boolean {
    return this.revokedAt !== null;
  }

  isExpired(): boolean {
    return this.expiresAt < new Date();
  }

  isWithinGracePeriod(gracePeriodMs: number): boolean {
    if (!this.revokedAt || !this.replacedByTokenId) {
      return false;
    }
    const elapsedMs = Date.now() - this.revokedAt.getTime();
    return elapsedMs <= gracePeriodMs;
  }
}

export namespace RefreshToken {
  export type Attributes = {
    id?: string;
    userId: string;
    tokenHash: string;
    familyId?: string;
    expiresAt: Date;
    revokedAt?: Date | null;
    replacedByTokenId?: string | null;
    createdAt?: Date;
  };
}
