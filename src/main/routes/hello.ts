import { Hono } from 'hono';
import { honoHttpAdapter } from '@main/adapters/honoHttpAdapter.js';
import { HelloWorldController } from '@application/controllers/hello/HelloWorldController.js';

const helloRoutes = new Hono();

helloRoutes.post('/hello', honoHttpAdapter(HelloWorldController));
helloRoutes.get('/hello', honoHttpAdapter(HelloWorldController));

export { helloRoutes };
