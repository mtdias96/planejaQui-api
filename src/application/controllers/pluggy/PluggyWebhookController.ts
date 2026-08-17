import { Controller } from '@application/contracts/Controller.js';
import { Schema } from '@kernel/decorators/Schema.js';
import { HandlePluggyWebhookUseCase } from '@application/useCases/pluggy/HandlePluggyWebhookUseCase.js';
import { pluggyWebhookSchema, PluggyWebhookBody } from './schemas/pluggyWebhookSchema.js';

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
    console.log('[pluggy] webhook received', {
      event: body.event,
      eventId: body.eventId,
      itemId: body.itemId,
      clientUserId: body.clientUserId,
      triggeredBy: body.triggeredBy,
      payload: body,
    });

    const result = await this.handlePluggyWebhookUseCase.execute({ payload: body });

    // Pluggy needs a 2XX within 5s or it redelivers — always answer 200 for a
    // delivery we understood, even when there was nothing to link.
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
