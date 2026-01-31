ALTER TABLE "runners" ADD COLUMN "kind" text DEFAULT 'rewrite' NOT NULL;
--> statement-breakpoint
UPDATE "runners" SET "kind" = 'rewrite' WHERE "kind" IS NULL;
