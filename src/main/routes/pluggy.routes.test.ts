import { describe, it, expect } from 'vitest';
import { pluggyRoutes } from './pluggy.js';

describe('pluggy routes', () => {
  it('answers CORS preflight for the browser-facing connect-token route', async () => {
    // Regression: these routes used a bare `new Hono()`, so the widget flow on
    // the frontend was blocked at preflight.
    const res = await pluggyRoutes.request('/pluggy/connect-token', {
      method: 'OPTIONS',
      headers: {
        'Origin': 'https://planejaqui.vercel.app',
        'Access-Control-Request-Method': 'POST',
        'Access-Control-Request-Headers': 'Content-Type, Authorization',
      },
    });

    expect(res.status).toBe(204);
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe('https://planejaqui.vercel.app');
  });

  it('requires authentication on GET /pluggy/accounts', async () => {
    const res = await pluggyRoutes.request('/pluggy/accounts', { method: 'GET' });

    expect(res.status).toBe(401);
  });

  it('requires authentication on GET /pluggy/transactions', async () => {
    const res = await pluggyRoutes.request('/pluggy/transactions', { method: 'GET' });

    expect(res.status).toBe(401);
  });

  it('requires authentication on GET /pluggy/transactions/summary', async () => {
    const res = await pluggyRoutes.request('/pluggy/transactions/summary', { method: 'GET' });

    expect(res.status).toBe(401);
  });

  it('requires the shared secret on the public webhook route', async () => {
    const res = await pluggyRoutes.request('/pluggy/webhook', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ event: 'item/updated', eventId: 'evt-1' }),
    });

    expect(res.status).toBe(401);
  });

  it('does not accept a user bearer token in place of the webhook secret', async () => {
    const res = await pluggyRoutes.request('/pluggy/webhook', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer whatever' },
      body: JSON.stringify({ event: 'item/updated', eventId: 'evt-1' }),
    });

    expect(res.status).toBe(401);
  });
});
