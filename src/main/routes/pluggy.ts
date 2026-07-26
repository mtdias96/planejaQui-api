import { Hono } from 'hono';
import { privateRoute } from '@main/factories/privateRoute.js';
import { CreateConnectTokenController } from '@application/controllers/pluggy/CreateConnectTokenController.js';

const pluggyRoutes = new Hono();

pluggyRoutes.post('/pluggy/connect-token', ...privateRoute(CreateConnectTokenController));

export { pluggyRoutes };
