import { Controller } from '@application/contracts/Controller.js';
import { Schema } from '@kernel/decorators/Schema.js';
import { SignInUseCase } from '@application/useCases/auth/SignInUseCase.js';
import { signInSchema, SignInBody } from './schemas/signInSchema.js';

@Schema(signInSchema)
export class SignInController extends Controller<'public', SignInController.Response> {
  static inject = [SignInUseCase];

  constructor(private readonly signInUseCase: SignInUseCase) {
    super();
  }

  protected override async handle(
    request: Controller.Request<'public', SignInBody>,
  ): Promise<Controller.Response<SignInController.Response>> {
    const result = await this.signInUseCase.execute(request.body);

    return {
      statusCode: 200,
      body: result,
    };
  }
}

export namespace SignInController {
  export type Response = {
    accessToken: string;
    refreshToken: string;
  };
}
