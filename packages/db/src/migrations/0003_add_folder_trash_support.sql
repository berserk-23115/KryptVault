-- Add trash bin support to folder table
ALTER TABLE "folder" ADD COLUMN "deleted_at" timestamp;
ALTER TABLE "folder" ADD COLUMN "deleted_by" text REFERENCES "user"("id");
ALTER TABLE "folder" ADD COLUMN "scheduled_deletion_at" timestamp;

-- Create index for efficient trash queries on folders
CREATE INDEX IF NOT EXISTS "folder_deleted_at_idx" ON "folder" ("deleted_at");
CREATE INDEX IF NOT EXISTS "folder_scheduled_deletion_at_idx" ON "folder" ("scheduled_deletion_at");
