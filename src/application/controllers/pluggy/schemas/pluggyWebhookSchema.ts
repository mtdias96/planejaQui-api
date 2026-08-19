import { z } from 'zod';

export const pluggyWebhookSchema = z.looseObject({
  event: z.string().min(1),
  eventId: z.string().min(1).optional(),
  itemId: z.string().nullish(),
  clientUserId: z.string().nullish(),
  triggeredBy: z.string().nullish(),
});

export type PluggyWebhookBody = z.infer<typeof pluggyWebhookSchema>;
