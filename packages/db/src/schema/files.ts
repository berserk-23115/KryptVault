import { pgTable, text, timestamp, bigint } from "drizzle-orm/pg-core";
import { user } from "./auth";

export const file = pgTable("file", {
	id: text("id").primaryKey(),
	userId: text("user_id")
		.notNull()
		.references(() => user.id, { onDelete: "cascade" }),
	
	// Original file metadata
	originalFilename: text("original_filename").notNull(),
	mimeType: text("mime_type"),
	fileSize: bigint("file_size", { mode: "number" }).notNull(),
	
	// S3 storage info
	s3Key: text("s3_key").notNull().unique(),
	s3Bucket: text("s3_bucket").notNull(),
	
	// Encryption metadata (wrapped DEK stored as base64)
	wrappedDek: text("wrapped_dek").notNull(), // Sealed box containing the file's DEK
	nonce: text("nonce").notNull(), // XChaCha20 nonce (base64 encoded)
	
	// Timestamps
	createdAt: timestamp("created_at").notNull().defaultNow(),
	updatedAt: timestamp("updated_at").notNull().defaultNow(),
	
	// Optional: Add tags, description, etc.
	description: text("description"),
	tags: text("tags").array(),
});
