import { describe, it, expect } from 'vitest';
import { PasswordHasher } from './PasswordHasher.js';

describe('PasswordHasher', () => {
  const hasher = new PasswordHasher();

  it('should hash password and not equal plaintext', async () => {
    const password = 'mySecurePassword';
    const hash = await hasher.hash(password);

    expect(hash).toBeDefined();
    expect(hash).not.toBe(password);
    expect(hash.startsWith('$argon2id$')).toBe(true);
  });

  it('should verify correct password', async () => {
    const password = 'mySecurePassword';
    const hash = await hasher.hash(password);

    const isValid = await hasher.verify(hash, password);
    expect(isValid).toBe(true);
  });

  it('should fail verification for incorrect password', async () => {
    const password = 'mySecurePassword';
    const hash = await hasher.hash(password);

    const isValid = await hasher.verify(hash, 'wrongPassword');
    expect(isValid).toBe(false);
  });
});
