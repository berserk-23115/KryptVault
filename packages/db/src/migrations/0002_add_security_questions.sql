-- Add security questions table for account recovery and 2FA
CREATE TABLE IF NOT EXISTS "security_question" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"question" text NOT NULL,
	"answer_hash" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);

-- Add foreign key constraint
ALTER TABLE "security_question" ADD CONSTRAINT "security_question_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE cascade ON UPDATE no action;

-- Add index for faster lookups
CREATE INDEX IF NOT EXISTS "security_question_user_id_idx" ON "security_question" ("user_id");
