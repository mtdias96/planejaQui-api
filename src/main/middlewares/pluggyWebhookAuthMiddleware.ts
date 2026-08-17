import { Context, MiddlewareHandler } from 'hono';
import { createHash, timingSafeEqual } from 'node:crypto';
import { Registry } from '@kernel/di/Registry.js';
import { AppConfig } from '@shared/config/AppConfig.js';
import { ErrorCode } from '@application/errors/ErrorCode.js';
import { HonoEnv } from '../adapters/honoHttpAdapter.js';

const WEBHOOK_SECRET_HEADER = 'X-Webhook-Secret';

export function pluggyWebhookAuthMiddleware(customConfig?: AppConfig): MiddlewareHandler<HonoEnv> {
  const config = customConfig ?? Registry.getInstance().resolve(AppConfig);

  return async (c, next) => {
    const expectedSecret = config.pluggy.webhookSecret;

    if (!expectedSecret) {
      if (config.isDevelopment) {
        // eslint-disable-next-line no-console
        console.warn('[pluggy] PLUGGY_WEBHOOK_SECRET is not set — webhook is unauthenticated.');
        return next();
      }

      // eslint-disable-next-line no-console
      console.error('[pluggy] PLUGGY_WEBHOOK_SECRET is not set — rejecting webhook.');
      return unauthorized(c);
    }

    const providedSecret = c.req.header(WEBHOOK_SECRET_HEADER);

    if (!providedSecret || !secretsMatch(providedSecret, expectedSecret)) {
      return unauthorized(c);
    }

    await next();
  };
}

function unauthorized(c: Context<HonoEnv>) {
  return c.json({
    code: ErrorCode.UNAUTHORIZED,
    message: 'Unauthorized',
  }, 401);
}

// Compara hashes SHA-256 de tamanho fixo com timingSafeEqual para proteção contra timing attacks
function secretsMatch(provided: string, expected: string): boolean {
  const providedDigest = createHash('sha256').update(provided).digest();
  const expectedDigest = createHash('sha256').update(expected).digest();

  return timingSafeEqual(providedDigest, expectedDigest);
}
