import { Controller } from '@application/contracts/Controller.js';
import { GetTransactionsSummaryUseCase } from '@application/useCases/pluggy/GetTransactionsSummaryUseCase.js';
import { getTransactionsSummaryQuerySchema } from './schemas/getTransactionsSummarySchema.js';

export class GetTransactionsSummaryController extends Controller<'private', GetTransactionsSummaryController.Response> {
  static inject = [GetTransactionsSummaryUseCase];

  constructor(private readonly getTransactionsSummaryUseCase: GetTransactionsSummaryUseCase) {
    super();
  }

  protected override async handle(
    request: Controller.Request<'private'>,
  ): Promise<Controller.Response<GetTransactionsSummaryController.Response>> {
    const query = getTransactionsSummaryQuerySchema.parse(request.queryParams ?? {});

    const result = await this.getTransactionsSummaryUseCase.execute({
      userId: request.accountId,
      accountId: query.accountId,
      month: query.month,
      from: query.from,
      to: query.to,
      status: query.status,
    });

    return {
      statusCode: 200,
      body: result,
    };
  }
}

export namespace GetTransactionsSummaryController {
  export type Response = GetTransactionsSummaryUseCase.Output;
}
