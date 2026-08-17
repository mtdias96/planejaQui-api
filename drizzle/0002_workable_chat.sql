CREATE TABLE "pluggy_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"pluggy_item_id" uuid NOT NULL,
	"connector_id" integer,
	"connector_name" text,
	"status" text,
	"execution_status" text,
	"last_synced_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "pluggy_items_pluggy_item_id_unique" UNIQUE("pluggy_item_id")
);
--> statement-breakpoint
CREATE TABLE "pluggy_accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"item_id" uuid NOT NULL,
	"pluggy_account_id" uuid NOT NULL,
	"type" text,
	"subtype" text,
	"name" text,
	"marketing_name" text,
	"number" text,
	"balance" numeric(19, 4),
	"currency_code" text,
	"owner" text,
	"tax_number" text,
	"raw" jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "pluggy_accounts_pluggy_account_id_unique" UNIQUE("pluggy_account_id")
);
--> statement-breakpoint
CREATE TABLE "pluggy_webhook_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_id" text NOT NULL,
	"event" text NOT NULL,
	"pluggy_item_id" text,
	"client_user_id" text,
	"triggered_by" text,
	"payload" jsonb NOT NULL,
	"received_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "pluggy_webhook_events_event_id_unique" UNIQUE("event_id")
);
--> statement-breakpoint
ALTER TABLE "pluggy_items" ADD CONSTRAINT "pluggy_items_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pluggy_accounts" ADD CONSTRAINT "pluggy_accounts_item_id_pluggy_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."pluggy_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "pluggy_items_user_id_idx" ON "pluggy_items" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "pluggy_accounts_item_id_idx" ON "pluggy_accounts" USING btree ("item_id");--> statement-breakpoint
CREATE INDEX "pluggy_webhook_events_item_idx" ON "pluggy_webhook_events" USING btree ("pluggy_item_id");