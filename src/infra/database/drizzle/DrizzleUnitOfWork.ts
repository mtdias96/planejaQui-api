import { UnitOfWork } from '@application/contracts/UnitOfWork.js';
import { DatabaseConnection, DbClient } from './connection.js';

export type DbTransaction = Parameters<Parameters<DbClient['transaction']>[0]>[0];

export class DrizzleUnitOfWork extends UnitOfWork {
  static inject = [DatabaseConnection];

  constructor(private readonly connection: DatabaseConnection) {
    super();
  }

  override async runInTransaction<T>(work: (tx?: DbTransaction) => Promise<T>): Promise<T> {
    try {
      return await this.connection.db.transaction(async (tx) => {
        return work(tx);
      });
    } catch (err: unknown) {
      if (err instanceof Error && err.message.includes('No transactions support')) {
        return work();
      }
      throw err;
    }
  }
}
