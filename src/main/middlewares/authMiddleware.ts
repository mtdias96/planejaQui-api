import { Context, Next } from 'hono';
import { Registry } from '@kernel/di/Registry.js';
import { TokenService } from '@infra/security/TokenService.js';
import { ErrorCode } from '@application/errors/ErrorCode.js';
import { HonoEnv } from '../adapters/honoHttpAdapter.js';

export async function authMiddleware(c: Context<HonoEnv>, next: Next) {
  const authHeader = c.req.header('Authorization');

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return c.json({
      code: ErrorCode.UNAUTHORIZED,
      message: 'Unauthorized',
    }, 401);
  }

  const token = authHeader.substring(7);

  try {
    const tokenService = Registry.getInstance().resolve(TokenService);
    const { userId } = await tokenService.verifyAccessToken(token);

    c.set('accountId', userId);
    await next();
  } catch {
    return c.json({
      code: ErrorCode.UNAUTHORIZED,
      message: 'Unauthorized',
    }, 401);
  }
}
