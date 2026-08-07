import { cors } from 'hono/cors';
import { MiddlewareHandler } from 'hono';
import { AppConfig } from '@shared/config/AppConfig.js';
import { Registry } from '@kernel/di/Registry.js';

export function corsMiddleware(): MiddlewareHandler {
  const config = Registry.getInstance().resolve(AppConfig);
  const allowedOriginsSet = new Set(config.cors.allowedOrigins);

  return cors({
    origin: (origin) => {
      if (!origin || !allowedOriginsSet.has(origin)) {
        return null;
      }

      return origin;
    },
    allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'Authorization'],
    maxAge: 7200,
  });
}
