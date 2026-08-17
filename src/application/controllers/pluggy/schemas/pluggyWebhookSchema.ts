import { z } from 'zod';

/**
 * Loose on purpose: Pluggy sends different resource ids per event type and adds
 * fields over time. Unknown keys are preserved so the whole delivery can be
 * stored for inspection.
 */
export const pluggyWebhookSchema = z.looseObject({
  event: z.string().min(1),
  eventId: z.string().min(1).optional(),
  itemId: z.string().nullish(),
  clientUserId: z.string().nullish(),
  triggeredBy: z.string().nullish(),
});

export type PluggyWebhookBody = z.infer<typeof pluggyWebhookSchema>;
