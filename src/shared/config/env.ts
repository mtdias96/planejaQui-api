import { z } from 'zod';

const schema = z.object({
  DATABASE_URL: z.string().min(1),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  JWT_SECRET: z.string().min(32),
  ACCESS_TOKEN_TTL: z.string().default('15m'),
  REFRESH_TOKEN_TTL_DAYS: z.coerce.number().default(30),
});

export const env = schema.parse(process.env);
