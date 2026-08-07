import crypto from 'node:crypto';

export class User {
  readonly id: string;
  readonly name: string;
  readonly email: string;
  readonly passwordHash: string;
  readonly termsAcceptedAt: Date;
  readonly createdAt: Date;

  emailVerifiedAt: Date | null;
  failedLoginAttempts: number;
  lockedUntil: Date | null;
  updatedAt: Date;

  constructor(attr: User.Attributes) {
    this.id = attr.id ?? crypto.randomUUID();
    this.name = attr.name;
    this.email = attr.email.toLowerCase().trim();
    this.passwordHash = attr.passwordHash;
    this.termsAcceptedAt = attr.termsAcceptedAt ?? new Date();
    this.emailVerifiedAt = attr.emailVerifiedAt ?? null;
    this.failedLoginAttempts = attr.failedLoginAttempts ?? 0;
    this.lockedUntil = attr.lockedUntil ?? null;
    this.createdAt = attr.createdAt ?? new Date();
    this.updatedAt = attr.updatedAt ?? this.createdAt;
  }

  isLocked(): boolean {
    return this.lockedUntil !== null && this.lockedUntil > new Date();
  }
}

export namespace User {
  export type Attributes = {
    id?: string;
    name: string;
    email: string;
    passwordHash: string;
    termsAcceptedAt?: Date;
    emailVerifiedAt?: Date | null;
    failedLoginAttempts?: number;
    lockedUntil?: Date | null;
    createdAt?: Date;
    updatedAt?: Date;
  };
}
