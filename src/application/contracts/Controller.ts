import { getSchema } from '@kernel/decorators/Schema.js';

export type TRouteType = 'public' | 'private';

export abstract class Controller<TType extends TRouteType, TBody = unknown> {
  protected abstract handle(request: Controller.Request<TType>): Promise<Controller.Response<TBody>>;

  public execute(request: Controller.Request<TType>): Promise<Controller.Response<TBody>> {
    const validatedBody = this.validateBody(request.body) as Controller.Request<TType>['body'];

    return this.handle({
      ...request,
      body: validatedBody,
    });
  }

  private validateBody(body: unknown): unknown {
    const schema = getSchema(this);
    if (!schema) {
      return body;
    }

    return schema.parse(body);
  }
}

export namespace Controller {
  type BaseRequest<
    TBody = unknown,
    TParams = Record<string, string>,
    TQueryParams = Record<string, string>,
  > = {
    body: TBody;
    params: TParams;
    queryParams: TQueryParams;
  };

  type PublicRequest<
    TBody = unknown,
    TParams = Record<string, string>,
    TQueryParams = Record<string, string>,
  > = BaseRequest<TBody, TParams, TQueryParams> & {
    accountId: null;
  };

  type PrivateRequest<
    TBody = unknown,
    TParams = Record<string, string>,
    TQueryParams = Record<string, string>,
  > = BaseRequest<TBody, TParams, TQueryParams> & {
    accountId: string;
  };

  export type Request<
    TType extends TRouteType,
    TBody = unknown,
    TParams = Record<string, string>,
    TQueryParams = Record<string, string>,
  > = TType extends 'public'
        ? PublicRequest<TBody, TParams, TQueryParams>
        : PrivateRequest<TBody, TParams, TQueryParams>;

  export type Response<TBody = unknown> = {
    statusCode: number;
    body?: TBody;
  };
}
