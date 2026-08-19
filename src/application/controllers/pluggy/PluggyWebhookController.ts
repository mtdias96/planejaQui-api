import { Controller } from '@application/contracts/Controller.js';
import { HandlePluggyWebhookUseCase } from '@application/useCases/pluggy/HandlePluggyWebhookUseCase.js';
import { Schema } from '@kernel/decorators/Schema.js';
import { PluggyWebhookBody, pluggyWebhookSchema } from './schemas/pluggyWebhookSchema.js';

@Schema(pluggyWebhookSchema)
export class PluggyWebhookController extends Controller<'public', PluggyWebhookController.Response> {
  static inject = [HandlePluggyWebhookUseCase];

  constructor(private readonly handlePluggyWebhookUseCase: HandlePluggyWebhookUseCase) {
    super();
  }

  protected override async handle(
    request: Controller.Request<'public', PluggyWebhookBody>,
  ): Promise<Controller.Response<PluggyWebhookController.Response>> {
    const body = request.body;

    // eslint-disable-next-line no-console
    console.log('[pluggy:webhook]', {
      event: body.event,
      eventId: body.eventId,
      itemId: body.itemId,
      triggeredBy: body.triggeredBy,
    });

    const result = await this.handlePluggyWebhookUseCase.execute({ payload: body });

    return {
      statusCode: 200,
      body: { received: true, ...result },
    };
  }
}

export namespace PluggyWebhookController {
  export type Response = {
    received: true;
  } & HandlePluggyWebhookUseCase.Output;
}
