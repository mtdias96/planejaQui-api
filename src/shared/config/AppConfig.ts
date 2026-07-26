import { env, parseEnv } from './env.js';

export class AppConfig {
  readonly db: AppConfig.Database;
  readonly auth: AppConfig.Auth;
  readonly cors: AppConfig.Cors;
  readonly pluggy: AppConfig.Pluggy;

  constructor(customEnv?: Record<string, string | undefined>) {
    const currentEnv = customEnv ? parseEnv(customEnv) : env;

    this.db = {
      url: currentEnv.DATABASE_URL,
    };
    this.auth = {
      jwtSecret: currentEnv.JWT_SECRET,
      accessTokenTtl: currentEnv.ACCESS_TOKEN_TTL,
      refreshTokenTtlDays: currentEnv.REFRESH_TOKEN_TTL_DAYS,
      refreshTokenGracePeriodMs: currentEnv.REFRESH_TOKEN_GRACE_PERIOD_SECONDS * 1000,
    };
    this.cors = {
      allowedOrigins: currentEnv.CORS_ALLOWED_ORIGINS_PARSED,
    };
    this.pluggy = {
      clientId: currentEnv.PLUGGY_CLIENT_ID,
      clientSecret: currentEnv.PLUGGY_CLIENT_SECRET,
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
    refreshTokenGracePeriodMs: number;
  };

  export type Cors = {
    allowedOrigins: string[];
  };

  export type Pluggy = {
    clientId: string;
    clientSecret: string;
  };
}
