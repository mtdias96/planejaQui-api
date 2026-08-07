import { describe, it, expect } from 'vitest';
import { Hono } from 'hono';
import { corsMiddleware } from './corsMiddleware.js';
import { AppConfig } from '@shared/config/AppConfig.js';

describe('CORS Middleware & Config Hardening', () => {
  it('should return 204 on OPTIONS preflight from allowed origin without credentials header', async () => {
    const app = new Hono();
    app.use('*', corsMiddleware());
    app.post('/test', (c) => c.json({ ok: true }));

    const res = await app.request('/test', {
      method: 'OPTIONS',
      headers: {
        'Origin': 'https://planejaqui.vercel.app',
        'Access-Control-Request-Method': 'POST',
        'Access-Control-Request-Headers': 'Content-Type, Authorization',
      },
    });

    expect(res.status).toBe(204);
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe('https://planejaqui.vercel.app');
    expect(res.headers.get('Access-Control-Allow-Credentials')).toBeNull();
    expect(res.headers.get('Access-Control-Max-Age')).toBe('7200');
  });

  it('should return null (no CORS header) when Origin header is missing (e.g., cURL, server-to-server)', async () => {
    const app = new Hono();
    app.use('*', corsMiddleware());
    app.get('/test', (c) => c.json({ message: 'hello' }));

    const res = await app.request('/test', {
      method: 'GET',
    });

    expect(res.status).toBe(200);
    expect(res.headers.get('Access-Control-Allow-Origin')).toBeNull();
  });

  it('should attach CORS origin header for valid requests from allowed origin', async () => {
    const app = new Hono();
    app.use('*', corsMiddleware());
    app.get('/test', (c) => c.json({ message: 'hello' }));

    const res = await app.request('/test', {
      method: 'GET',
      headers: {
        'Origin': 'https://planejaqui.vercel.app',
      },
    });

    expect(res.status).toBe(200);
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe('https://planejaqui.vercel.app');
  });

  it('should reject unauthorized origins', async () => {
    const app = new Hono();
    app.use('*', corsMiddleware());
    app.get('/test', (c) => c.json({ message: 'secret' }));

    const res = await app.request('/test', {
      method: 'GET',
      headers: {
        'Origin': 'https://unauthorized-domain.com',
      },
    });

    expect(res.headers.get('Access-Control-Allow-Origin')).toBeNull();
  });

  it('should throw security error if CORS_ALLOWED_ORIGINS has invalid scheme, wildcard, or URL', () => {
    expect(() => new AppConfig({
      ...process.env,
      CORS_ALLOWED_ORIGINS: '*',
    })).toThrow('[SECURITY ERROR] Invalid CORS origin URL: "*". Must include scheme (http:// or https://).');

    expect(() => new AppConfig({
      ...process.env,
      CORS_ALLOWED_ORIGINS: 'planejaqui.vercel.app',
    })).toThrow('[SECURITY ERROR] Invalid CORS origin URL: "planejaqui.vercel.app". Must include scheme (http:// or https://).');

    expect(() => new AppConfig({
      ...process.env,
      CORS_ALLOWED_ORIGINS: 'ftp://planejaqui.vercel.app',
    })).toThrow('[SECURITY ERROR] Invalid CORS origin protocol: "ftp:". Must be http: or https:.');
  });

  it('should filter out localhost origins in production', () => {
    const config = new AppConfig({
      ...process.env,
      NODE_ENV: 'production',
      CORS_ALLOWED_ORIGINS: 'http://localhost:3000,https://planejaqui.vercel.app',
    });

    expect(config.cors.allowedOrigins).toEqual(['https://planejaqui.vercel.app']);
  });

  it('should throw security error if CORS_ALLOWED_ORIGINS resolves to empty in production', () => {
    expect(() => new AppConfig({
      ...process.env,
      NODE_ENV: 'production',
      CORS_ALLOWED_ORIGINS: 'http://localhost:3000',
    })).toThrow('[SECURITY ERROR] CORS_ALLOWED_ORIGINS is empty or invalid for production.');
  });
});
