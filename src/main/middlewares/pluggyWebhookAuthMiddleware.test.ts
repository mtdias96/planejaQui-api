import { describe, it, expect } from 'vitest';
import { Hono } from 'hono';
import { AppConfig } from '@shared/config/AppConfig.js';
import { pluggyWebhookAuthMiddleware } from './pluggyWebhookAuthMiddleware.js';

const SECRET = 'a'.repeat(64);

function buildApp(env: Record<string, string | undefined>) {
  const app = new Hono();
  app.use('/pluggy/webhook', pluggyWebhookAuthMiddleware(new AppConfig(env)));
  app.post('/pluggy/webhook', (c) => c.json({ received: true }));
  return app;
}

function post(app: Hono, headers: Record<string, string> = {}) {
  return app.request('/pluggy/webhook', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify({ event: 'item/updated' }),
  });
}

describe('pluggyWebhookAuthMiddleware', () => {
  const configured = { ...process.env, PLUGGY_WEBHOOK_SECRET: SECRET };

  it('accepts a delivery carrying the configured secret', async () => {
    const res = await post(buildApp(configured), { 'X-Webhook-Secret': SECRET });

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ received: true });
  });

  it('rejects a wrong secret', async () => {
    const res = await post(buildApp(configured), { 'X-Webhook-Secret': 'b'.repeat(64) });

    expect(res.status).toBe(401);
  });

  it('rejects a secret of a different length', async () => {
    const res = await post(buildApp(configured), { 'X-Webhook-Secret': 'short' });

    expect(res.status).toBe(401);
  });

  it('rejects a delivery with no secret header', async () => {
    const res = await post(buildApp(configured));

    expect(res.status).toBe(401);
  });

  it('fails closed outside development when no secret is configured', async () => {
    const res = await post(buildApp({
      ...process.env,
      NODE_ENV: 'production',
      PLUGGY_WEBHOOK_SECRET: '',
    }), { 'X-Webhook-Secret': SECRET });

    expect(res.status).toBe(401);
  });

  it('allows an unconfigured secret in development, for tunnelled testing', async () => {
    const res = await post(buildApp({
      ...process.env,
      NODE_ENV: 'development',
      PLUGGY_WEBHOOK_SECRET: '',
    }));

    expect(res.status).toBe(200);
  });
});
