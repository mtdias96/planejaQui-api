import { Controller } from '@application/contracts/Controller.js';
import { Schema } from '@kernel/decorators/Schema.js';
import { SignOutUseCase } from '@application/useCases/auth/SignOutUseCase.js';
import { signOutSchema, SignOutBody } from './schemas/signOutSchema.js';

@Schema(signOutSchema)
export class SignOutController extends Controller<'public', void> {
  static inject = [SignOutUseCase];

  constructor(private readonly signOutUseCase: SignOutUseCase) {
    super();
  }

  protected override async handle(
    request: Controller.Request<'public', SignOutBody>,
  ): Promise<Controller.Response<void>> {
    await this.signOutUseCase.execute(request.body);

    return {
      statusCode: 204,
    };
  }
}
