import { env } from './env.js';

export class AppConfig {
  readonly db: AppConfig.Database;

  constructor() {
    this.db = {
      url: env.DATABASE_URL,
    };
  }
}

export namespace AppConfig {
  export type Database = {
    url: string;
  };
}
// Note: no decorator is used here to remain compatible with our fast compile setup.
