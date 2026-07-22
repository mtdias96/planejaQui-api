import { Hono } from 'hono';
import { honoHttpAdapter } from '@main/adapters/honoHttpAdapter.js';
import { SignUpController } from '@application/controllers/auth/SignUpController.js';
import { SignInController } from '@application/controllers/auth/SignInController.js';
import { RefreshTokenController } from '@application/controllers/auth/RefreshTokenController.js';
import { SignOutController } from '@application/controllers/auth/SignOutController.js';

const authRoutes = new Hono();

authRoutes.post('/auth/signup', honoHttpAdapter(SignUpController));
authRoutes.post('/auth/signin', honoHttpAdapter(SignInController));
authRoutes.post('/auth/refresh', honoHttpAdapter(RefreshTokenController));
authRoutes.post('/auth/signout', honoHttpAdapter(SignOutController));

export { authRoutes };
