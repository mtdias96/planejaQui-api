import { Controller } from '@application/contracts/Controller.js';
import { Schema } from '@kernel/decorators/Schema.js';
import { RefreshTokenUseCase } from '@application/useCases/auth/RefreshTokenUseCase.js';
import { refreshTokenSchema, RefreshTokenBody } from './schemas/refreshTokenSchema.js';

@Schema(refreshTokenSchema)
export class RefreshTokenController extends Controller<'public', RefreshTokenController.Response> {
  static inject = [RefreshTokenUseCase];

  constructor(private readonly refreshTokenUseCase: RefreshTokenUseCase) {
    super();
  }

  protected override async handle(
    request: Controller.Request<'public', RefreshTokenBody>,
  ): Promise<Controller.Response<RefreshTokenController.Response>> {
    const result = await this.refreshTokenUseCase.execute(request.body);

    return {
      statusCode: 200,
      body: result,
    };
  }
}

export namespace RefreshTokenController {
  export type Response = {
    accessToken: string;
    refreshToken: string;
  };
}
