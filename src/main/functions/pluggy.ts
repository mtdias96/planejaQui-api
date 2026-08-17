import { handle as lambdaHandle } from 'hono/aws-lambda';
import { pluggyRoutes } from '@main/routes/pluggy.js';

export const handle = lambdaHandle(pluggyRoutes);
