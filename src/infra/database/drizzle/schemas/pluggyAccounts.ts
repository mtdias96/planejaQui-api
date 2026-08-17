import { pgTable, uuid, text, timestamp, numeric, jsonb, index } from 'drizzle-orm/pg-core';
import { pluggyItems } from './pluggyItems.js';

export const pluggyAccounts = pgTable('pluggy_accounts', {
  id: uuid('id').defaultRandom().primaryKey(),
  itemId: uuid('item_id').notNull().references(() => pluggyItems.id, { onDelete: 'cascade' }),
  pluggyAccountId: uuid('pluggy_account_id').notNull().unique(),
  type: text('type'),
  subtype: text('subtype'),
  name: text('name'),
  marketingName: text('marketing_name'),
  number: text('number'),
  balance: numeric('balance', { precision: 19, scale: 4 }),
  currencyCode: text('currency_code'),
  owner: text('owner'),
  taxNumber: text('tax_number'),
  raw: jsonb('raw').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => [
  index('pluggy_accounts_item_id_idx').on(table.itemId),
]);

export type PluggyAccount = typeof pluggyAccounts.$inferSelect;
export type NewPluggyAccount = typeof pluggyAccounts.$inferInsert;
