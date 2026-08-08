import { createApp } from '@main/factories/createApp.js';
import { honoHttpAdapter } from '@main/adapters/honoHttpAdapter.js';
import { privateRoute } from '@main/factories/privateRoute.js';
import { SignUpController } from '@application/controllers/auth/SignUpController.js';
import { SignInController } from '@application/controllers/auth/SignInController.js';
import { RefreshTokenController } from '@application/controllers/auth/RefreshTokenController.js';
import { SignOutController } from '@application/controllers/auth/SignOutController.js';
import { GetMeController } from '@application/controllers/auth/GetMeController.js';

const authRoutes = createApp();

authRoutes.post('/auth/signup', honoHttpAdapter(SignUpController));
authRoutes.post('/auth/signin', honoHttpAdapter(SignInController));
authRoutes.post('/auth/refresh', honoHttpAdapter(RefreshTokenController));
authRoutes.post('/auth/signout', honoHttpAdapter(SignOutController));
authRoutes.get('/auth/me', ...privateRoute(GetMeController));

export { authRoutes };
