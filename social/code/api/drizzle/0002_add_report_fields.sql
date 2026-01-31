ALTER TABLE "reports" ADD COLUMN "contact_email" text;
ALTER TABLE "reports" ADD COLUMN "ip_address" text;
ALTER TABLE "reports" ADD COLUMN "messages" jsonb;
ALTER TABLE "reports" ADD COLUMN "client_meta" jsonb;
