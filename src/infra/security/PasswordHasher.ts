import { argon2id, argon2Verify } from 'hash-wasm';
import crypto from 'node:crypto';

export class PasswordHasher {
  async hash(password: string): Promise<string> {
    const salt = new Uint8Array(crypto.randomBytes(16));
    return argon2id({
      password,
      salt,
      iterations: 2,
      memorySize: 19456,
      parallelism: 1,
      hashLength: 32,
      outputType: 'encoded',
    });
  }

  async verify(phc: string, password: string): Promise<boolean> {
    return argon2Verify({
      password,
      hash: phc,
    });
  }
}
