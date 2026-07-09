import { handle as lambdaHandle } from 'hono/aws-lambda';
import { helloRoutes } from '@main/routes/hello.js';

export const handle = lambdaHandle(helloRoutes);
