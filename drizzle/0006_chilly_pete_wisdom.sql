ALTER TABLE "pluggy_accounts" ALTER COLUMN "created_at" SET DATA TYPE timestamp with time zone USING "created_at" AT TIME ZONE 'UTC';--> statement-breakpoint
ALTER TABLE "pluggy_accounts" ALTER COLUMN "created_at" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "pluggy_accounts" ALTER COLUMN "updated_at" SET DATA TYPE timestamp with time zone USING "updated_at" AT TIME ZONE 'UTC';--> statement-breakpoint
ALTER TABLE "pluggy_accounts" ALTER COLUMN "updated_at" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "pluggy_webhook_events" ALTER COLUMN "received_at" SET DATA TYPE timestamp with time zone USING "received_at" AT TIME ZONE 'UTC';--> statement-breakpoint
ALTER TABLE "pluggy_webhook_events" ALTER COLUMN "received_at" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "pluggy_accounts" ADD COLUMN IF NOT EXISTS "transactions_synced_through" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "pluggy_webhook_events" ADD COLUMN IF NOT EXISTS "processing_status" text DEFAULT 'pending' NOT NULL;--> statement-breakpoint
ALTER TABLE "pluggy_webhook_events" ADD COLUMN IF NOT EXISTS "processed_at" timestamp with time zone;--> statement-breakpoint
UPDATE "pluggy_webhook_events" SET "processing_status" = 'done', "processed_at" = "received_at";

