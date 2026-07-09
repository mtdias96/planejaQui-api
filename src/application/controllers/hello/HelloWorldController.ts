import { Controller } from '@application/contracts/Controller.js';
import { Schema } from '@kernel/decorators/Schema.js';
import { helloWorldSchema, HelloWorldBody } from './schemas/helloWorldSchema.js';

@Schema(helloWorldSchema)
export class HelloWorldController extends Controller<'public', HelloWorldController.Response> {
  protected override async handle(
    request: Controller.Request<'public', HelloWorldBody>,
  ): Promise<Controller.Response<HelloWorldController.Response>> {
    const name = request.body.name ?? 'World';

    return {
      statusCode: 200,
      body: {
        message: `Hello ${name}! This is the new Clean Architecture!`,
      },
    };
  }
}

export namespace HelloWorldController {
  export type Response = {
    message: string;
  };
}
