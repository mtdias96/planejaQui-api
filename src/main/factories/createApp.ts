import { Hono } from 'hono';
import { corsMiddleware } from '@main/middlewares/corsMiddleware.js';

export function createApp(): Hono {
  const app = new Hono();
  app.use('*', corsMiddleware());
  return app;
}
