import { neon } from '@neondatabase/serverless';
import { drizzle, NeonHttpDatabase } from 'drizzle-orm/neon-http';
import { AppConfig } from '@shared/config/AppConfig.js';
import * as schema from './schemas/index.js';

export type DbClient = NeonHttpDatabase<typeof schema>;

export class DatabaseConnection {
  static inject = [AppConfig];

  public readonly db: DbClient;

  constructor(config: AppConfig) {
    const sql = neon(config.db.url);
    this.db = drizzle({ client: sql, schema });
  }
}
