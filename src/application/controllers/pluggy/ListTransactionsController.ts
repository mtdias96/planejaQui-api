import { Controller } from '@application/contracts/Controller.js';
import { ListTransactionsUseCase } from '@application/useCases/pluggy/ListTransactionsUseCase.js';

export class ListTransactionsController extends Controller<'private', ListTransactionsController.Response> {
  static inject = [ListTransactionsUseCase];

  constructor(private readonly listTransactionsUseCase: ListTransactionsUseCase) {
    super();
  }

  protected override async handle(
    request: Controller.Request<'private'>,
  ): Promise<Controller.Response<ListTransactionsController.Response>> {
    const accountId = request.queryParams?.accountId;

    const result = await this.listTransactionsUseCase.execute({
      userId: request.accountId,
      accountId: typeof accountId === 'string' ? accountId : undefined,
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
