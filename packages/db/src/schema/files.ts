import { pgTable, text, timestamp, bigint, integer } from "drizzle-orm/pg-core";
import { user } from "./auth";

export const file = pgTable("file", {
	id: text("id").primaryKey(),
	userId: text("user_id")
		.notNull()
		.references(() => user.id, { onDelete: "cascade" }),
	
	// Optional folder reference
	folderId: text("folder_id"),
	
	// Original file metadata
	originalFilename: text("original_filename").notNull(),
	mimeType: text("mime_type"),
	fileSize: bigint("file_size", { mode: "number" }).notNull(),
	
	// S3 storage info
	s3Key: text("s3_key").notNull().unique(),
	s3Bucket: text("s3_bucket").notNull(),
	
	// Encryption metadata
	// NOTE: wrappedDek is DEPRECATED - use file_keys table instead
	// Kept for backward compatibility only
	wrappedDek: text("wrapped_dek"), 
	nonce: text("nonce").notNull(), // XChaCha20 nonce (base64 encoded)
	
	// Timestamps
	createdAt: timestamp("created_at").notNull().defaultNow(),
	updatedAt: timestamp("updated_at").notNull().defaultNow(),
	
	// Trash/soft delete fields
	deletedAt: timestamp("deleted_at"), // When file was moved to trash
	deletedBy: text("deleted_by").references(() => user.id), // Who deleted it
	scheduledDeletionAt: timestamp("scheduled_deletion_at"), // When to permanently delete
	
	// Optional: Add tags, description, etc.
	description: text("description"),
	tags: text("tags").array(),
});

// File keys - wrapped DEKs for each user with access
// This is the core of the sharing system
export const fileKey = pgTable("file_key", {
	id: text("id").primaryKey(),
	fileId: text("file_id")
		.notNull()
		.references(() => file.id, { onDelete: "cascade" }),
	recipientUserId: text("recipient_user_id")
		.notNull()
		.references(() => user.id, { onDelete: "cascade" }),
	
	// DEK wrapped with recipient's X25519 public key (sealed box)
	wrappedDek: text("wrapped_dek").notNull(), // Base64 encoded
	
	// Sharing metadata
	sharedBy: text("shared_by")
		.notNull()
		.references(() => user.id, { onDelete: "cascade" }), // Who shared it
	
	createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Folders for organizing files
export const folder = pgTable("folder", {
	id: text("id").primaryKey(),
	ownerId: text("owner_id")
		.notNull()
		.references(() => user.id, { onDelete: "cascade" }),
	
	name: text("name").notNull(),
	description: text("description"),
	parentFolderId: text("parent_folder_id"), // For nested folders
	
	createdAt: timestamp("created_at").notNull().defaultNow(),
	updatedAt: timestamp("updated_at").notNull().defaultNow(),
	
	// Trash/soft delete fields
	deletedAt: timestamp("deleted_at"), // When folder was moved to trash
	deletedBy: text("deleted_by").references(() => user.id), // Who deleted it
	scheduledDeletionAt: timestamp("scheduled_deletion_at"), // When to permanently delete
});

// Folder keys - wrapped folder DEKs for each user with access
// Files in the folder have their DEKs encrypted with the folder key
export const folderKey = pgTable("folder_key", {
	id: text("id").primaryKey(),
	folderId: text("folder_id")
		.notNull()
		.references(() => folder.id, { onDelete: "cascade" }),
	recipientUserId: text("recipient_user_id")
		.notNull()
		.references(() => user.id, { onDelete: "cascade" }),
	
	// Folder DEK wrapped with recipient's X25519 public key
	wrappedFolderKey: text("wrapped_folder_key").notNull(), // Base64 encoded
	
	// Sharing metadata
	sharedBy: text("shared_by")
		.notNull()
		.references(() => user.id, { onDelete: "cascade" }),
	
	createdAt: timestamp("created_at").notNull().defaultNow(),
});

// File folder keys - DEKs wrapped with folder keys (for folder-based encryption)
export const fileFolderKey = pgTable("file_folder_key", {
	id: text("id").primaryKey(),
	fileId: text("file_id")
		.notNull()
		.references(() => file.id, { onDelete: "cascade" }),
	folderId: text("folder_id")
		.notNull()
		.references(() => folder.id, { onDelete: "cascade" }),
	
	// File DEK encrypted with folder key (symmetric encryption, not sealed box)
	wrappedDek: text("wrapped_dek").notNull(), // Base64 encoded
	wrappingNonce: text("wrapping_nonce").notNull(), // Nonce for wrapping encryption
	
	createdAt: timestamp("created_at").notNull().defaultNow(),
});

// User settings for trash and other preferences
export const userSettings = pgTable("user_settings", {
	id: text("id").primaryKey(),
	userId: text("user_id")
		.notNull()
		.unique()
		.references(() => user.id, { onDelete: "cascade" }),
	
	// Trash auto-deletion settings (in days)
	// 0 = never auto-delete, positive number = delete after N days
	trashRetentionDays: integer("trash_retention_days").notNull().default(30),
	
	createdAt: timestamp("created_at").notNull().defaultNow(),
	updatedAt: timestamp("updated_at").notNull().defaultNow(),
});
