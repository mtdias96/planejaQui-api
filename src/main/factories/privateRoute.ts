import { authMiddleware } from '@main/middlewares/authMiddleware.js';
import { honoHttpAdapter } from '@main/adapters/honoHttpAdapter.js';
import { Controller } from '@application/contracts/Controller.js';
import { IInjectableClass } from '@kernel/di/Registry.js';

export const privateRoute = (controllerImpl: IInjectableClass<Controller<'private', unknown>>) =>
  [
    authMiddleware,
    honoHttpAdapter(controllerImpl as unknown as IInjectableClass<Controller<'public', unknown>>),
  ] as const;
