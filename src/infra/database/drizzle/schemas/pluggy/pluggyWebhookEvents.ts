import { pgTable, uuid, text, timestamp, jsonb, index } from 'drizzle-orm/pg-core';

// Log bruto para auditoria e idempotência de webhooks (eventId único evita duplicidade)
export const pluggyWebhookEvents = pgTable('pluggy_webhook_events', {
  id: uuid('id').defaultRandom().primaryKey(),
  eventId: text('event_id').notNull().unique(),
  event: text('event').notNull(),
  pluggyItemId: text('pluggy_item_id'),
  clientUserId: text('client_user_id'),
  triggeredBy: text('triggered_by'),
  payload: jsonb('payload').notNull(),
  // Estado de processamento: 'pending' marca apenas a entrega, 'done' marca a ingestão concluída.
  // O dedupe só descarta entregas cujo processamento já terminou, para que o retry da Pluggy
  // consiga retomar um evento que morreu no meio (timeout, restart, deploy).
  processingStatus: text('processing_status').default('pending').notNull(),
  processedAt: timestamp('processed_at', { withTimezone: true }),
  receivedAt: timestamp('received_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index('pluggy_webhook_events_item_idx').on(table.pluggyItemId),
]);

export type PluggyWebhookEvent = typeof pluggyWebhookEvents.$inferSelect;
export type NewPluggyWebhookEvent = typeof pluggyWebhookEvents.$inferInsert;
