import { DatabaseConnection, DbClient } from '../connection.js';
import { DbTransaction } from '../DrizzleUnitOfWork.js';
import { TransactionContext } from '@application/contracts/UnitOfWork.js';
import { refreshTokens, RefreshToken, NewRefreshToken } from '../schemas/refreshTokens.js';
import { eq } from 'drizzle-orm';

export class RefreshTokensRepository {
  static inject = [DatabaseConnection];

  constructor(private readonly connection: DatabaseConnection) {}

  private getDb(tx?: TransactionContext): DbClient | DbTransaction {
    return (tx as DbTransaction) ?? this.connection.db;
  }

  async create(data: NewRefreshToken, tx?: TransactionContext): Promise<RefreshToken> {
    const db = this.getDb(tx);
    const [result] = await db
      .insert(refreshTokens)
      .values(data)
      .returning();
    return result;
  }

  async findByHash(tokenHash: string, tx?: TransactionContext): Promise<RefreshToken | null> {
    const db = this.getDb(tx);
    const [result] = await db
      .select()
      .from(refreshTokens)
      .where(eq(refreshTokens.tokenHash, tokenHash));
    return result ?? null;
  }

  async revoke(id: string, replacedByTokenId?: string, tx?: TransactionContext): Promise<void> {
    const db = this.getDb(tx);
    await db
      .update(refreshTokens)
      .set({
        revokedAt: new Date(),
        replacedByTokenId: replacedByTokenId ?? null,
      })
      .where(eq(refreshTokens.id, id));
  }

  async revokeFamily(familyId: string, tx?: TransactionContext): Promise<void> {
    const db = this.getDb(tx);
    await db
      .update(refreshTokens)
      .set({
        revokedAt: new Date(),
      })
      .where(eq(refreshTokens.familyId, familyId));
  }
}
