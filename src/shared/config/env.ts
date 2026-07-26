import { z } from 'zod';

const emptyToUndefined = (v: unknown) => (typeof v === 'string' && v.trim() === '' ? undefined : v);

function parseCorsOrigin(rawUrl: string): string {
  const trimmed = rawUrl.trim();
  if (!trimmed) {
    return '';
  }

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    throw new Error(`[SECURITY ERROR] Invalid CORS origin URL: "${rawUrl}". Must include scheme (http:// or https://).`);
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error(`[SECURITY ERROR] Invalid CORS origin protocol: "${parsed.protocol}". Must be http: or https:.`);
  }

  return parsed.origin;
}

function parseCorsOrigins(rawInput: string | undefined, nodeEnv: string): string[] {
  const defaultRaw = rawInput || 'https://planejaqui.vercel.app';
  const parsedList = defaultRaw
    .split(',')
    .map(url => parseCorsOrigin(url))
    .filter(Boolean);

  let origins = Array.from(new Set(parsedList));

  if (nodeEnv === 'production') {
    origins = origins.filter(origin => {
      const parsed = new URL(origin);
      return parsed.hostname !== 'localhost' && parsed.hostname !== '127.0.0.1';
    });

    if (origins.length === 0) {
      throw new Error('[SECURITY ERROR] CORS_ALLOWED_ORIGINS is empty or invalid for production.');
    }
  } else {
    const devDefaults = ['http://localhost:3000', 'http://127.0.0.1:3000'];
    devDefaults.forEach(devUrl => {
      if (!origins.includes(devUrl)) {
        origins.push(devUrl);
      }
    });
  }

  return origins;
}

const schema = z.object({
  DATABASE_URL: z.string().min(1),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  JWT_SECRET: z.string().min(32),
  ACCESS_TOKEN_TTL: z.preprocess(emptyToUndefined, z.string().default('15m')),
  REFRESH_TOKEN_TTL_DAYS: z.preprocess(emptyToUndefined, z.coerce.number().default(30)),
  PLUGGY_CLIENT_ID: z.string().min(1),
  PLUGGY_CLIENT_SECRET: z.string().min(1),
  REFRESH_TOKEN_GRACE_PERIOD_SECONDS: z.preprocess(emptyToUndefined, z.coerce.number().default(10)),
  CORS_ALLOWED_ORIGINS: z.preprocess(emptyToUndefined, z.string().optional()),
}).transform((data) => {
  const allowedOrigins = parseCorsOrigins(data.CORS_ALLOWED_ORIGINS, data.NODE_ENV);

  return {
    ...data,
    CORS_ALLOWED_ORIGINS_PARSED: allowedOrigins,
  };
});

export function parseEnv(customEnv: Record<string, string | undefined> = process.env) {
  return schema.parse(customEnv);
}

export const env = parseEnv(process.env);
