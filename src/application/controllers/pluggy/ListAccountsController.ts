import { Controller } from '@application/contracts/Controller.js';
import { ListAccountsUseCase } from '@application/useCases/pluggy/ListAccountsUseCase.js';

export class ListAccountsController extends Controller<'private', ListAccountsController.Response> {
  static inject = [ListAccountsUseCase];

  constructor(private readonly listAccountsUseCase: ListAccountsUseCase) {
    super();
  }

  protected override async handle(
    request: Controller.Request<'private'>,
  ): Promise<Controller.Response<ListAccountsController.Response>> {
    // No itemId comes from the request: the caller's connections are looked up
    // from our own table, so nobody can read someone else's item.
    const result = await this.listAccountsUseCase.execute({
      userId: request.accountId,
    });

    return {
      statusCode: 200,
      body: result,
    };
  }
}

export namespace ListAccountsController {
  export type Response = ListAccountsUseCase.Output;
}
