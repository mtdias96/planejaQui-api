CREATE TABLE "pluggy_transactions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"account_id" uuid NOT NULL,
	"pluggy_transaction_id" uuid NOT NULL,
	"description" text NOT NULL,
	"amount" numeric(19, 4) NOT NULL,
	"currency_code" text NOT NULL,
	"date" timestamp NOT NULL,
	"category" text,
	"type" text,
	"status" text,
	"raw" jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "pluggy_transactions_pluggy_transaction_id_unique" UNIQUE("pluggy_transaction_id")
);
--> statement-breakpoint
ALTER TABLE "pluggy_transactions" ADD CONSTRAINT "pluggy_transactions_account_id_pluggy_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."pluggy_accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "pluggy_transactions_account_id_idx" ON "pluggy_transactions" USING btree ("account_id");