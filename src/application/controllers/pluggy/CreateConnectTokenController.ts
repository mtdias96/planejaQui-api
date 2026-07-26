import { Controller } from '@application/contracts/Controller.js';
import { CreateConnectTokenUseCase } from '@application/useCases/pluggy/CreateConnectTokenUseCase.js';

export class CreateConnectTokenController extends Controller<'private', CreateConnectTokenController.Response> {
  static inject = [CreateConnectTokenUseCase];

  constructor(private readonly createConnectTokenUseCase: CreateConnectTokenUseCase) {
    super();
  }

  protected override async handle(
    request: Controller.Request<'private'>,
  ): Promise<Controller.Response<CreateConnectTokenController.Response>> {
    // The connect token is bound to the authenticated user, taken from the
    // access token — never trusted from the request body.
    const { accessToken } = await this.createConnectTokenUseCase.execute({
      clientUserId: request.accountId,
    });

    return {
      statusCode: 200,
      body: { accessToken },
    };
  }
}

export namespace CreateConnectTokenController {
  export type Response = {
    accessToken: string;
  };
}
