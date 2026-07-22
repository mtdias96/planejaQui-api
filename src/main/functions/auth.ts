import { handle as lambdaHandle } from 'hono/aws-lambda';
import { authRoutes } from '@main/routes/auth.js';

export const handle = lambdaHandle(authRoutes);
