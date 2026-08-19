import { pgTable, uuid, text, timestamp, numeric, jsonb, index } from 'drizzle-orm/pg-core';
import { pluggyAccounts } from './pluggyAccounts.js';

export const pluggyTransactions = pgTable('pluggy_transactions', {
  id: uuid('id').defaultRandom().primaryKey(),
  accountId: uuid('account_id').notNull().references(() => pluggyAccounts.id, { onDelete: 'cascade' }),
  pluggyTransactionId: uuid('pluggy_transaction_id').notNull().unique(),
  description: text('description').notNull(),
  amount: numeric('amount', { precision: 19, scale: 4 }).notNull(),
  currencyCode: text('currency_code').notNull(),
  date: timestamp('date', { withTimezone: true }).notNull(),
  category: text('category'),
  categoryId: text('category_id'),
  type: text('type'),
  status: text('status'),
  balance: numeric('balance', { precision: 19, scale: 4 }),
  raw: jsonb('raw').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index('pluggy_transactions_account_date_idx').on(table.accountId, table.date),
]);

export type PluggyTransaction = typeof pluggyTransactions.$inferSelect;
export type NewPluggyTransaction = typeof pluggyTransactions.$inferInsert;
