ALTER TABLE "payment_numbers"
ADD COLUMN IF NOT EXISTS "ussd_code" text;
