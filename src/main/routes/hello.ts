import { createApp } from '@main/factories/createApp.js';
import { honoHttpAdapter } from '@main/adapters/honoHttpAdapter.js';
import { HelloWorldController } from '@application/controllers/hello/HelloWorldController.js';

const helloRoutes = createApp();

helloRoutes.post('/hello', honoHttpAdapter(HelloWorldController));
helloRoutes.get('/hello', honoHttpAdapter(HelloWorldController));

export { helloRoutes };
