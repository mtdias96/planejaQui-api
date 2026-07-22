import { DatabaseConnection, DbClient } from '../connection.js';
import { DbTransaction } from '../DrizzleUnitOfWork.js';
import { TransactionContext } from '@application/contracts/UnitOfWork.js';
import { users, User, NewUser } from '../schemas/users.js';
import { eq, sql } from 'drizzle-orm';

export class UsersRepository {
  static inject = [DatabaseConnection];

  constructor(private readonly connection: DatabaseConnection) {}

  private getDb(tx?: TransactionContext): DbClient | DbTransaction {
    return (tx as DbTransaction) ?? this.connection.db;
  }

  async findByEmail(email: string, tx?: TransactionContext): Promise<User | null> {
    const db = this.getDb(tx);
    const [result] = await db
      .select()
      .from(users)
      .where(eq(users.email, email.toLowerCase().trim()));
    return result ?? null;
  }

  async findById(id: string, tx?: TransactionContext): Promise<User | null> {
    const db = this.getDb(tx);
    const [result] = await db
      .select()
      .from(users)
      .where(eq(users.id, id));
    return result ?? null;
  }

  async create(data: NewUser, tx?: TransactionContext): Promise<User> {
    const db = this.getDb(tx);
    const [result] = await db
      .insert(users)
      .values(data)
      .returning();
    return result;
  }

  async incrementFailedLogin(id: string, tx?: TransactionContext): Promise<void> {
    const db = this.getDb(tx);
    await db
      .update(users)
      .set({
        failedLoginAttempts: sql`${users.failedLoginAttempts} + 1`,
        lockedUntil: sql`CASE WHEN ${users.failedLoginAttempts} + 1 >= 5 THEN NOW() + INTERVAL '15 minutes' ELSE NULL END`,
        updatedAt: new Date(),
      })
      .where(eq(users.id, id));
  }

  async resetFailedLogin(id: string, tx?: TransactionContext): Promise<void> {
    const db = this.getDb(tx);
    await db
      .update(users)
      .set({
        failedLoginAttempts: 0,
        lockedUntil: null,
        updatedAt: new Date(),
      })
      .where(eq(users.id, id));
  }

  async touchLogin(id: string, tx?: TransactionContext): Promise<void> {
    const db = this.getDb(tx);
    await db
      .update(users)
      .set({
        updatedAt: new Date(),
      })
      .where(eq(users.id, id));
  }
}
