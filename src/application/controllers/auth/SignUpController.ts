import { Controller } from '@application/contracts/Controller.js';
import { Schema } from '@kernel/decorators/Schema.js';
import { SignUpUseCase } from '@application/useCases/auth/SignUpUseCase.js';
import { signUpSchema, SignUpBody } from './schemas/signUpSchema.js';

@Schema(signUpSchema)
export class SignUpController extends Controller<'public', SignUpController.Response> {
  static inject = [SignUpUseCase];

  constructor(private readonly signUpUseCase: SignUpUseCase) {
    super();
  }

  protected override async handle(
    request: Controller.Request<'public', SignUpBody>,
  ): Promise<Controller.Response<SignUpController.Response>> {
    const result = await this.signUpUseCase.execute(request.body);

    return {
      statusCode: 201,
      body: result,
    };
  }
}

export namespace SignUpController {
  export type Response = {
    accessToken: string;
    refreshToken: string;
  };
}
