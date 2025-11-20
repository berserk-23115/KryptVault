-- Add trash bin support to file table
ALTER TABLE "file" ADD COLUMN "deleted_at" timestamp;
ALTER TABLE "file" ADD COLUMN "deleted_by" text REFERENCES "user"("id");
ALTER TABLE "file" ADD COLUMN "scheduled_deletion_at" timestamp;

-- Create user_settings table for trash preferences
CREATE TABLE IF NOT EXISTS "user_settings" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL UNIQUE,
	"trash_retention_days" integer DEFAULT 30 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE
);

-- Create index for efficient trash queries
CREATE INDEX IF NOT EXISTS "file_deleted_at_idx" ON "file" ("deleted_at");
CREATE INDEX IF NOT EXISTS "file_scheduled_deletion_at_idx" ON "file" ("scheduled_deletion_at");
