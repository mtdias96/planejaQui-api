import { Controller } from '@application/contracts/Controller.js';
import { GetMeUseCase } from '@application/useCases/auth/GetMeUseCase.js';

export class GetMeController extends Controller<'private', GetMeController.Response> {
  static inject = [GetMeUseCase];

  constructor(private readonly getMeUseCase: GetMeUseCase) {
    super();
  }

  protected override async handle(
    request: Controller.Request<'private'>,
  ): Promise<Controller.Response<GetMeController.Response>> {
    const result = await this.getMeUseCase.execute({
      userId: request.accountId,
    });

    return {
      statusCode: 200,
      body: result,
    };
  }
}

export namespace GetMeController {
  export type Response = GetMeUseCase.Output;
}
