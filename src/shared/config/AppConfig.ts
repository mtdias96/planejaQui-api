import { env } from './env.js';

export class AppConfig {
  readonly db: AppConfig.Database;
  readonly auth: AppConfig.Auth;

  constructor() {
    this.db = {
      url: env.DATABASE_URL,
    };
    this.auth = {
      jwtSecret: env.JWT_SECRET,
      accessTokenTtl: env.ACCESS_TOKEN_TTL,
      refreshTokenTtlDays: env.REFRESH_TOKEN_TTL_DAYS,
    };
  }
}

export namespace AppConfig {
  export type Database = {
    url: string;
  };

  export type Auth = {
    jwtSecret: string;
    accessTokenTtl: string;
    refreshTokenTtlDays: number;
  };
}

