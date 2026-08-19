import { pgTable, uuid, text, timestamp, integer, index } from 'drizzle-orm/pg-core';
import { users } from '../auth/users.js';

// Mapeia conexões bancárias da Pluggy (Items) para os usuários do sistema
export const pluggyItems = pgTable('pluggy_items', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  pluggyItemId: uuid('pluggy_item_id').notNull().unique(),
  connectorId: integer('connector_id'),
  connectorName: text('connector_name'),
  status: text('status'),
  executionStatus: text('execution_status'),
  lastSyncedAt: timestamp('last_synced_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => [
  index('pluggy_items_user_id_idx').on(table.userId),
]);

export type PluggyItem = typeof pluggyItems.$inferSelect;
export type NewPluggyItem = typeof pluggyItems.$inferInsert;
