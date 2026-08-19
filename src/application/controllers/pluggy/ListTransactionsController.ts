import { Controller } from '@application/contracts/Controller.js';
import { ListTransactionsUseCase } from '@application/useCases/pluggy/ListTransactionsUseCase.js';
import { listTransactionsQuerySchema } from './schemas/listTransactionsSchema.js';

export class ListTransactionsController extends Controller<'private', ListTransactionsController.Response> {
  static inject = [ListTransactionsUseCase];

  constructor(private readonly listTransactionsUseCase: ListTransactionsUseCase) {
    super();
  }

  protected override async handle(
    request: Controller.Request<'private'>,
  ): Promise<Controller.Response<ListTransactionsController.Response>> {
    const query = listTransactionsQuerySchema.parse(request.queryParams ?? {});

    const result = await this.listTransactionsUseCase.execute({
      userId: request.accountId,
      accountId: query.accountId,
      from: query.from,
      to: query.to,
      status: query.status,
      limit: query.limit,
      offset: query.offset,
      sync: query.sync,
    });

    return {
      statusCode: 200,
      body: result,
    };
  }
}

export namespace ListTransactionsController {
  export type Response = ListTransactionsUseCase.Output;
}
