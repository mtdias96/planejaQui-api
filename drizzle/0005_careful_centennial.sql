DROP INDEX IF EXISTS "pluggy_transactions_account_id_idx";--> statement-breakpoint
ALTER TABLE "pluggy_transactions" ALTER COLUMN "date" SET DATA TYPE timestamp with time zone USING "date" AT TIME ZONE 'UTC';--> statement-breakpoint
ALTER TABLE "pluggy_transactions" ALTER COLUMN "created_at" SET DATA TYPE timestamp with time zone USING "created_at" AT TIME ZONE 'UTC';--> statement-breakpoint
ALTER TABLE "pluggy_transactions" ALTER COLUMN "created_at" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "pluggy_transactions" ALTER COLUMN "updated_at" SET DATA TYPE timestamp with time zone USING "updated_at" AT TIME ZONE 'UTC';--> statement-breakpoint
ALTER TABLE "pluggy_transactions" ALTER COLUMN "updated_at" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "pluggy_transactions" ADD COLUMN IF NOT EXISTS "balance" numeric(19, 4);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "pluggy_transactions_account_date_idx" ON "pluggy_transactions" USING btree ("account_id","date");