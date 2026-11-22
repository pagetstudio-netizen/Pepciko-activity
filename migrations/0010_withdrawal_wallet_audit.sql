CREATE TABLE IF NOT EXISTS "withdrawal_wallet_audit" (
  "id" serial PRIMARY KEY,
  "user_id" integer NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "wallet_id" integer,
  "actor_user_id" integer REFERENCES "users"("id") ON DELETE SET NULL,
  "actor_role" text NOT NULL,
  "action" text NOT NULL,
  "old_account_name" text,
  "old_account_number" text,
  "old_payment_method" text,
  "old_country" text,
  "new_account_name" text,
  "new_account_number" text,
  "new_payment_method" text,
  "new_country" text,
  "created_at" timestamp NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "withdrawal_wallet_audit_user_created_idx"
  ON "withdrawal_wallet_audit" ("user_id", "created_at");
