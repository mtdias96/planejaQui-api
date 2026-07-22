import { Context } from 'hono';
import { ZodError } from 'zod';
import { Controller, TRouteType } from '@application/contracts/Controller.js';
import { ApplicationError } from '@application/errors/application/ApplicationError.js';
import { ErrorCode } from '@application/errors/ErrorCode.js';
import { HttpError } from '@application/errors/http/HttpError.js';
import { Registry, IInjectableClass } from '@kernel/di/Registry.js';

type HonoJsonStatus = Parameters<Context['json']>[1];

export type HonoEnv = {
  Variables: {
    accountId?: string | null;
  };
};

export function honoHttpAdapter(controllerImpl: IInjectableClass<Controller<TRouteType, unknown>>) {
  return async (c: Context<HonoEnv>): Promise<Response> => {
    try {
      const controller = Registry.getInstance().resolve(controllerImpl);

      let body: unknown = {};
      if (['POST', 'PUT', 'PATCH'].includes(c.req.method)) {
        try {
          body = await c.req.json();
        } catch {
          body = {};
        }
      }

      const params = c.req.param();
      const queryParams = c.req.query();

      const accountId = c.get('accountId') ?? null;

      const response = await controller.execute({
        body,
        params,
        queryParams,
        accountId,
      } as Controller.Request<TRouteType>);

      return c.json(response.body, response.statusCode as HonoJsonStatus);

    } catch (error: unknown) {
      if (error instanceof ZodError) {
        return c.json({
          code: ErrorCode.VALIDATION,
          message: error.issues.map(issue => ({
            field: issue.path.join('.'),
            error: issue.message,
          })),
        }, 400);
      }

      if (error instanceof HttpError) {
        return c.json({
          code: error.code,
          message: error.message,
        }, error.statusCode as HonoJsonStatus);
      }

      if (error instanceof ApplicationError) {
        return c.json({
          code: error.code,
          message: error.message,
        }, (error.statusCode ?? 400) as HonoJsonStatus);
      }

      // eslint-disable-next-line no-console
      console.error(error);

      return c.json({
        code: ErrorCode.INTERNAL_SERVER_ERROR,
        message: 'Internal server error.',
      }, 500);
    }
  };
}
