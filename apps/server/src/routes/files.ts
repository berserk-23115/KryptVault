import { Hono } from "hono";
import { db, file, fileKey, user, folderKey, fileFolderKey } from "@krypt-vault/db";
import { eq, and, desc, sql } from "@krypt-vault/db";
import { PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { v4 as uuidv4 } from "uuid";
import { z } from "zod";
import sodium from "libsodium-wrappers";
import { auth } from "@krypt-vault/auth";
import { s3Client, s3Presigner, BUCKET_NAME } from "../lib/s3";

// Server keypair for sealing/unsealing DEKs (should be stored securely in production)
let SERVER_PUBLIC_KEY: string;
let SERVER_PRIVATE_KEY: string;

// Validation schemas no longer used but kept for reference
// const downloadRequestSchema = z.object({
// 	fileId: z.string(),
// });

// Initialize libsodium and generate/load server keypair
async function initializeCrypto() {
	await sodium.ready;
	
	// In production, load these from secure environment variables or a key management service
	// For now, we'll generate them or use environment variables
	if (process.env.SERVER_PUBLIC_KEY && process.env.SERVER_PRIVATE_KEY) {
		SERVER_PUBLIC_KEY = process.env.SERVER_PUBLIC_KEY;
		SERVER_PRIVATE_KEY = process.env.SERVER_PRIVATE_KEY;
	} else {
		const keypair = sodium.crypto_box_keypair();
		SERVER_PUBLIC_KEY = Buffer.from(keypair.publicKey).toString("base64");
		SERVER_PRIVATE_KEY = Buffer.from(keypair.privateKey).toString("base64");
		
		console.log("⚠️  WARNING: Generated ephemeral server keypair. In production, store these securely!");
		console.log("SERVER_PUBLIC_KEY:", SERVER_PUBLIC_KEY);
		console.log("SERVER_PRIVATE_KEY:", SERVER_PRIVATE_KEY);
	}
}

// Initialize crypto on startup
initializeCrypto();

const app = new Hono();

// Validation schemas
const uploadRequestSchema = z.object({
	filename: z.string(),
	mimeType: z.string().optional(),
	fileSize: z.number(),
});

const uploadCompleteSchema = z.object({
	fileId: z.string(),
	s3Key: z.string(),
	wrappedDek: z.string(), // DEK wrapped with uploader's X25519 public key
	nonce: z.string(),
	originalFilename: z.string(),
	fileSize: z.number(),
	mimeType: z.string().optional(),
	description: z.string().optional(),
	tags: z.array(z.string()).optional(),
	folderId: z.string().optional(), // Optional folder assignment
});

// Middleware to extract user from session
app.use("*", async (c, next) => {
	console.log(`🔍 Files route middleware: ${c.req.method} ${c.req.path}`);
	
	// Get session using better-auth
	const session = await auth.api.getSession({
		headers: c.req.raw.headers
	});
	
	if (!session?.user) {
		// For development: allow bypass
		const devUserId = c.req.header("x-user-id");
		
		if (devUserId) {
			// Use header if provided
			console.log(`👤 Using x-user-id header: ${devUserId}`);
			(c as any).set("userId", devUserId);
		} else if (process.env.NODE_ENV === "development") {
			// Use default dev user in development mode
			console.warn("⚠️ No session found. Using dev user ID: dev-user-123");
			(c as any).set("userId", "dev-user-123");
		} else {
			// Reject in production
			console.error("❌ No session and not in development mode");
			return c.json({ error: "Unauthorized" }, 401);
		}
	} else {
		// Use authenticated user ID
		console.log(`✅ Authenticated user: ${session.user.id}`);
		(c as any).set("userId", session.user.id);
	}
	
	await next();
});

// GET /api/files/server-public-key - Get server's public key for encryption
app.get("/server-public-key", (c) => {
	return c.json({
		publicKey: SERVER_PUBLIC_KEY,
	});
});

// GET /api/files/storage-usage - Get current storage usage and quota
app.get("/storage-usage", async (c) => {
	try {
		const userId = (c as any).get("userId") as string;
		
		const STORAGE_QUOTA = 1_073_741_824; // 1GB in bytes
		
		// Calculate current storage usage (excluding deleted files)
		const storageResult = await db
			.select({ totalSize: sql<number>`COALESCE(SUM(${file.fileSize}), 0)` })
			.from(file)
			.where(
				and(
					eq(file.userId, userId),
					sql`${file}.deleted_at IS NULL`
				)
			);
		
		const usedBytes = Number(storageResult[0]?.totalSize || 0);
		
		// Calculate file counts by type
		const fileStats = await db
			.select({
				mimeType: file.mimeType,
				originalFilename: file.originalFilename,
				totalSize: sql<number>`SUM(${file.fileSize})`,
				count: sql<number>`COUNT(*)`,
			})
			.from(file)
			.where(
				and(
					eq(file.userId, userId),
					sql`${file}.deleted_at IS NULL`
				)
			)
			.groupBy(file.mimeType, file.originalFilename);
		
		// Categorize files
		let imageBytes = 0;
		let videoBytes = 0;
		let documentBytes = 0;
		let otherBytes = 0;
		
		// Helper function to detect category from filename if MIME type is missing
		function getCategoryFromFilename(filename: string): string {
			const ext = filename.split('.').pop()?.toLowerCase() || '';
			
			const imageExts = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp', 'ico'];
			const videoExts = ['mp4', 'avi', 'mov', 'wmv', 'flv', 'webm', 'mkv'];
			const docExts = ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'txt', 'rtf', 'odt'];
			
			if (imageExts.includes(ext)) return 'image';
			if (videoExts.includes(ext)) return 'video';
			if (docExts.includes(ext)) return 'document';
			return 'other';
		}
		
		for (const stat of fileStats) {
			const size = Number(stat.totalSize);
			const mime = stat.mimeType || '';
			
			let category = 'other';
			
			if (mime.startsWith('image/')) {
				category = 'image';
			} else if (mime.startsWith('video/')) {
				category = 'video';
			} else if (
				mime.startsWith('application/pdf') ||
				mime.includes('document') ||
				mime.includes('text') ||
				mime === 'text/plain'
			) {
				category = 'document';
			} else if (!mime || mime === 'application/octet-stream') {
				// Fall back to filename-based detection if MIME type is missing or generic
				category = getCategoryFromFilename(stat.originalFilename);
			}
			
			switch (category) {
				case 'image':
					imageBytes += size;
					break;
				case 'video':
					videoBytes += size;
					break;
				case 'document':
					documentBytes += size;
					break;
				default:
					otherBytes += size;
			}
		}
		
		return c.json({
			usedBytes,
			quotaBytes: STORAGE_QUOTA,
			usedPercentage: (usedBytes / STORAGE_QUOTA) * 100,
			breakdown: {
				images: imageBytes,
				videos: videoBytes,
				documents: documentBytes,
				others: otherBytes,
			},
		});
	} catch (error) {
		console.error("Storage usage error:", error);
		return c.json({ error: "Failed to get storage usage" }, 500);
	}
});


// POST /api/files/upload/init - Initialize file upload and get presigned URL
app.post("/upload/init", async (c) => {
	try {
		const body = await c.req.json();
		console.log("📤 Upload init request:", body);
		
		uploadRequestSchema.parse(body); // Validate input
		const userId = (c as any).get("userId") as string;
		
		console.log("👤 User ID:", userId);
		
		// Check storage quota (1GB = 1,073,741,824 bytes)
		const STORAGE_QUOTA = 1_073_741_824; // 1GB in bytes
		
		// Calculate current storage usage
		const storageResult = await db
			.select({ totalSize: sql<number>`COALESCE(SUM(${file.fileSize}), 0)` })
			.from(file)
			.where(
				and(
					eq(file.userId, userId),
					sql`${file}.deleted_at IS NULL` // Don't count deleted files
				)
			);
		
		const currentUsage = Number(storageResult[0]?.totalSize || 0);
		const requestedSize = body.fileSize;
		
		console.log(`📊 Storage check: ${currentUsage} / ${STORAGE_QUOTA} bytes (requesting ${requestedSize})`);
		
		if (currentUsage + requestedSize > STORAGE_QUOTA) {
			const usedMB = (currentUsage / (1024 * 1024)).toFixed(2);
			const quotaMB = (STORAGE_QUOTA / (1024 * 1024)).toFixed(2);
			return c.json({ 
				error: `Storage quota exceeded. You are using ${usedMB} MB of ${quotaMB} MB. This file would exceed your limit.`,
				storageUsed: currentUsage,
				storageQuota: STORAGE_QUOTA,
			}, 400);
		}
		
		// Generate unique file ID and S3 key
		const fileId = uuidv4();
		const s3Key = `${userId}/${fileId}`;
		
		console.log("🔑 Generated S3 key:", s3Key);
		
		// Generate presigned URL for upload (valid for 15 minutes)
		const command = new PutObjectCommand({
			Bucket: BUCKET_NAME,
			Key: s3Key,
			ContentType: "application/octet-stream", // Always encrypted binary
		});
		
		// Use s3Presigner to generate URL with correct public hostname
		const presignedUrl = await getSignedUrl(s3Presigner, command, {
			expiresIn: 900, // 15 minutes
		});
		
		console.log("✅ Presigned URL generated successfully");
		console.log("🔗 Public URL:", presignedUrl);
		
		return c.json({
			fileId,
			s3Key,
			presignedUrl,
			serverPublicKey: SERVER_PUBLIC_KEY,
		});
	} catch (error) {
		console.error("❌ Upload init error:", error);
		return c.json({ 
			error: "Failed to initialize upload", 
			details: error instanceof Error ? error.message : String(error)
		}, 500);
	}
});

// POST /api/files/upload/complete - Complete upload and store metadata
app.post("/upload/complete", async (c) => {
	try {
		const body = await c.req.json();
		console.log("📦 Upload complete request:", body);
		
		const data = uploadCompleteSchema.parse(body);
		const userId = (c as any).get("userId") as string;
		
		console.log("💾 Saving file metadata to database...");
		
		// Store file metadata in database (without wrappedDek - deprecated)
		await db.insert(file).values({
			id: data.fileId,
			userId,
			folderId: data.folderId,
			originalFilename: data.originalFilename,
			mimeType: data.mimeType || "application/octet-stream",
			fileSize: data.fileSize,
			s3Key: data.s3Key,
			s3Bucket: BUCKET_NAME,
			wrappedDek: null, // DEPRECATED - use fileKey table
			nonce: data.nonce,
			description: data.description,
			tags: data.tags,
			createdAt: new Date(),
			updatedAt: new Date(),
		}).returning();
		
		// Store wrapped DEK in fileKey table for the uploader
		await db.insert(fileKey).values({
			id: crypto.randomUUID(),
			fileId: data.fileId,
			recipientUserId: userId,
			wrappedDek: data.wrappedDek,
			sharedBy: userId, // Owner shares with themselves
			createdAt: new Date(),
		});
		
		console.log("✅ File metadata saved successfully");
		
		return c.json({
			success: true,
			fileId: data.fileId,
		});
	} catch (error) {
		console.error("❌ Upload complete error:", error);
		return c.json({ 
			error: "Failed to complete upload",
			details: error instanceof Error ? error.message : String(error)
		}, 500);
	}
});

// GET /api/files or /api/files/ - List user's files (owned + shared)
// IMPORTANT: This must come BEFORE the /:fileId route to avoid conflicts
app.get("/", async (c) => {
	try {
		const userId = (c as any).get("userId") as string;
		
		console.log("📋 Listing files for user:", userId);
		
		// Get files where user has a file key (owned or shared) and NOT deleted
		const files = await db
			.select({
				fileId: file.id,
				userId: file.userId,
				originalFilename: file.originalFilename,
				mimeType: file.mimeType,
				fileSize: file.fileSize,
				s3Key: file.s3Key,
				s3Bucket: file.s3Bucket,
				nonce: file.nonce,
				createdAt: file.createdAt,
				updatedAt: file.updatedAt,
				description: file.description,
				tags: file.tags,
				folderId: file.folderId,
				wrappedDek: fileKey.wrappedDek,
				isOwner: sql<boolean>`${file.userId} = ${userId}`,
				ownerName: user.name,
				ownerEmail: user.email,
			})
			.from(fileKey)
			.innerJoin(file, eq(fileKey.fileId, file.id))
			.innerJoin(user, eq(file.userId, user.id))
			.where(
				and(
					eq(fileKey.recipientUserId, userId),
					sql`${file}.deleted_at IS NULL` // Only show non-deleted files
				)
			)
			.orderBy(desc(file.createdAt));
		
		console.log(`✅ Found ${files.length} files`);
		
		return c.json({ files });
	} catch (error) {
		console.error("❌ List files error:", error);
		return c.json({ error: "Failed to list files" }, 500);
	}
});

// GET /api/files/trash - List files in trash (must come before /:fileId)
app.get("/trash", async (c) => {
	try {
		const userId = (c as any).get("userId") as string;
		
		console.log("🗑️ Listing trash files for user:", userId);
		
		// Get deleted files where user is the owner
		const trashedFiles = await db
			.select({
				fileId: file.id,
				userId: file.userId,
				originalFilename: file.originalFilename,
				mimeType: file.mimeType,
				fileSize: file.fileSize,
				s3Key: file.s3Key,
				s3Bucket: file.s3Bucket,
				nonce: file.nonce,
				createdAt: file.createdAt,
				updatedAt: file.updatedAt,
				deletedAt: sql<Date>`${file}.deleted_at`,
				deletedBy: sql<string>`${file}.deleted_by`,
				scheduledDeletionAt: sql<Date>`${file}.scheduled_deletion_at`,
				description: file.description,
				tags: file.tags,
				folderId: file.folderId,
				wrappedDek: fileKey.wrappedDek,
			})
			.from(fileKey)
			.innerJoin(file, eq(fileKey.fileId, file.id))
			.where(
				and(
					eq(fileKey.recipientUserId, userId),
					eq(file.userId, userId), // Only show files user owns
					sql`${file}.deleted_at IS NOT NULL` // Only deleted files
				)
			)
			.orderBy(sql`${file}.deleted_at DESC`);
		
		console.log(`✅ Found ${trashedFiles.length} files in trash`);
		
		return c.json({ files: trashedFiles });
	} catch (error) {
		console.error("❌ List trash error:", error);
		return c.json({ error: "Failed to list trash files" }, 500);
	}
});

// POST /api/files/cleanup - Cleanup expired files from trash (must come before /:fileId)
app.post("/cleanup", async (c) => {
	try {
		// Optional: Add API key authentication for cron jobs
		const apiKey = c.req.header("x-api-key");
		if (process.env.CLEANUP_API_KEY && apiKey !== process.env.CLEANUP_API_KEY) {
			return c.json({ error: "Unauthorized" }, 401);
		}
		
		console.log("🧹 Starting trash cleanup...");
		
		// Find files that should be permanently deleted
		const expiredFiles = await db
			.select()
			.from(file)
			.where(
				sql`${file}.deleted_at IS NOT NULL AND ${file}.scheduled_deletion_at IS NOT NULL AND ${file}.scheduled_deletion_at < NOW()`
			);
		
		console.log(`Found ${expiredFiles.length} expired files to delete`);
		
		let successCount = 0;
		let errorCount = 0;
		
		for (const fileRecord of expiredFiles) {
			try {
				// Delete from S3
				await s3Client.send(new DeleteObjectCommand({
					Bucket: fileRecord.s3Bucket,
					Key: fileRecord.s3Key,
				}));
				
				// Delete from database
				await db.delete(file).where(eq(file.id, fileRecord.id));
				
				successCount++;
				console.log(`✅ Permanently deleted expired file: ${fileRecord.id}`);
			} catch (error) {
				errorCount++;
				console.error(`❌ Failed to delete file ${fileRecord.id}:`, error);
			}
		}
		
		console.log(`🧹 Cleanup complete: ${successCount} deleted, ${errorCount} errors`);
		
		return c.json({ 
			success: true,
			deleted: successCount,
			errors: errorCount,
			total: expiredFiles.length,
		});
	} catch (error) {
		console.error("Cleanup error:", error);
		return c.json({ error: "Failed to cleanup trash" }, 500);
	}
});

// POST /api/files/:fileId/restore - Restore file from trash (must come before /:fileId)
app.post("/:fileId/restore", async (c) => {
	try {
		const fileId = c.req.param("fileId");
		const userId = (c as any).get("userId") as string;
		
		console.log(`🔄 Restoring file ${fileId} from trash`);
		
		// Check if file exists in trash
		const [fileRecord] = await db
			.select()
			.from(file)
			.where(
				and(
					eq(file.id, fileId),
					eq(file.userId, userId),
					sql`${file}.deleted_at IS NOT NULL`
				)
			)
			.limit(1);
		
		if (!fileRecord) {
			console.error(`❌ File ${fileId} not found in trash`);
			return c.json({ error: "File not found in trash" }, 404);
		}
		
		// Check if the file was in a folder and if that folder still exists
		let shouldClearFolderId = false;
		if (fileRecord.folderId) {
			const { folder } = await import("@krypt-vault/db");
			const [folderRecord] = await db
				.select({
					id: folder.id,
					deletedAt: sql<Date | null>`${folder}.deleted_at`,
				})
				.from(folder)
				.where(eq(folder.id, fileRecord.folderId))
				.limit(1);
			
			// Only clear folderId if folder doesn't exist at all
			// If folder is just in trash, keep the association so it can be restored later
			if (!folderRecord) {
				shouldClearFolderId = true;
				console.log(`⚠️ File's folder doesn't exist, removing folder association`);
			} else if (folderRecord.deletedAt) {
				console.log(`📁 File's folder is in trash, keeping association for potential folder restore`);
			}
		}
		
		// Restore file: clear deletion fields and optionally clear folderId
		if (shouldClearFolderId) {
			await db.execute(
				sql`UPDATE file 
					SET deleted_at = NULL, 
						deleted_by = NULL, 
						scheduled_deletion_at = NULL,
						folder_id = NULL,
						updated_at = NOW() 
					WHERE id = ${fileId}`
			);
		} else {
			await db.execute(
				sql`UPDATE file 
					SET deleted_at = NULL, 
						deleted_by = NULL, 
						scheduled_deletion_at = NULL, 
						updated_at = NOW() 
					WHERE id = ${fileId}`
			);
		}
		
		console.log(`✅ File ${fileId} restored from trash`);
		
		return c.json({ 
			success: true,
			message: shouldClearFolderId 
				? "File restored successfully (original folder no longer exists)" 
				: "File restored successfully",
			folderCleared: shouldClearFolderId,
		});
	} catch (error) {
		console.error("Restore file error:", error);
		return c.json({ error: "Failed to restore file" }, 500);
	}
});

// DELETE /api/files/:fileId/permanent - Permanently delete file (must come before /:fileId)
app.delete("/:fileId/permanent", async (c) => {
	try {
		const fileId = c.req.param("fileId");
		const userId = (c as any).get("userId") as string;
		
		console.log(`🗑️ Permanently deleting file ${fileId}`);
		
		const [fileRecord] = await db
			.select()
			.from(file)
			.where(
				and(
					eq(file.id, fileId),
					eq(file.userId, userId),
					sql`${file}.deleted_at IS NOT NULL` // Must be in trash
				)
			)
			.limit(1);
		
		if (!fileRecord) {
			console.error(`❌ File ${fileId} not found in trash`);
			return c.json({ error: "File not found in trash" }, 404);
		}
		
		// Delete from S3
		try {
			await s3Client.send(new DeleteObjectCommand({
				Bucket: fileRecord.s3Bucket,
				Key: fileRecord.s3Key,
			}));
			console.log(`✅ Deleted ${fileRecord.s3Key} from S3`);
		} catch (s3Error) {
			console.error("⚠️ Failed to delete from S3:", s3Error);
			// Continue with database deletion even if S3 fails
		}
		
		// Delete from database (cascades to fileKey)
		await db.delete(file).where(eq(file.id, fileId));
		
		console.log(`✅ File ${fileId} permanently deleted`);
		
		return c.json({ 
			success: true,
			message: "File permanently deleted",
		});
	} catch (error) {
		console.error("Permanent delete error:", error);
		return c.json({ error: "Failed to permanently delete file" }, 500);
	}
});

// GET /api/files/:fileId - Get file metadata
app.get("/:fileId", async (c) => {
	try {
		const fileId = c.req.param("fileId");
		const userId = (c as any).get("userId") as string;
		
		const [fileRecord] = await db
			.select()
			.from(file)
			.where(and(eq(file.id, fileId), eq(file.userId, userId)))
			.limit(1);
		
		if (!fileRecord) {
			return c.json({ error: "File not found" }, 404);
		}
		
		return c.json(fileRecord);
	} catch (error) {
		console.error("Get file error:", error);
		return c.json({ error: "Failed to get file" }, 500);
	}
});

// POST /api/files/:fileId/download - Get presigned download URL and decryption metadata
app.post("/:fileId/download", async (c) => {
	try {
		const fileId = c.req.param("fileId");
		const userId = (c as any).get("userId") as string;
		
		// Get file metadata
		const [fileRecord] = await db
			.select()
			.from(file)
			.where(eq(file.id, fileId))
			.limit(1);
		
		if (!fileRecord) {
			return c.json({ error: "File not found" }, 404);
		}
		
		// Check if user owns the file
		if (fileRecord.userId === userId) {
			// Owner can download
			// Check if file is in a folder
			if (fileRecord.folderId) {
				// File is in a folder - need to get folder key and file-folder key
				const [folderKeyRecord] = await db
					.select()
					.from(folderKey)
					.where(
						and(
							eq(folderKey.folderId, fileRecord.folderId),
							eq(folderKey.recipientUserId, userId)
						)
					)
					.limit(1);
				
				if (!folderKeyRecord) {
					return c.json({ error: "Folder access not found" }, 500);
				}
				
				const [fileFolderKeyRecord] = await db
					.select()
					.from(fileFolderKey)
					.where(
						and(
							eq(fileFolderKey.fileId, fileId),
							eq(fileFolderKey.folderId, fileRecord.folderId)
						)
					)
					.limit(1);
				
				if (!fileFolderKeyRecord) {
					return c.json({ error: "File encryption key not found for folder" }, 500);
				}
				
				// Generate presigned URL
				const command = new GetObjectCommand({
					Bucket: fileRecord.s3Bucket,
					Key: fileRecord.s3Key,
				});
				
				const presignedUrl = await getSignedUrl(s3Presigner, command, {
					expiresIn: 900, // 15 minutes
				});
				
				// Return folder key and file-folder key so owner can decrypt
				return c.json({
					downloadUrl: presignedUrl,
					wrappedFolderKey: folderKeyRecord.wrappedFolderKey, // Folder key wrapped with owner's key
					wrappedDek: fileFolderKeyRecord.wrappedDek, // DEK wrapped with folder key
					wrappingNonce: fileFolderKeyRecord.wrappingNonce,
					nonce: fileRecord.nonce,
					originalFilename: fileRecord.originalFilename,
					mimeType: fileRecord.mimeType,
				});
		}
		
		// File is not in a folder - check fileKey table first, then fall back to deprecated wrappedDek
		const [ownerFileKey] = await db
			.select()
			.from(fileKey)
			.where(
				and(
					eq(fileKey.fileId, fileId),
					eq(fileKey.recipientUserId, userId)
				)
			)
			.limit(1);
		
		if (ownerFileKey) {
			// Use the wrappedDek from fileKey table (new method)
			const command = new GetObjectCommand({
				Bucket: fileRecord.s3Bucket,
				Key: fileRecord.s3Key,
			});
			
			const presignedUrl = await getSignedUrl(s3Presigner, command, {
				expiresIn: 900, // 15 minutes
			});
			
			return c.json({
				downloadUrl: presignedUrl,
				wrappedDek: ownerFileKey.wrappedDek,
				nonce: fileRecord.nonce,
				originalFilename: fileRecord.originalFilename,
				mimeType: fileRecord.mimeType,
			});
		}
		
		// Fall back to deprecated wrappedDek field for old files
		if (!fileRecord.wrappedDek) {
			return c.json({ error: "File encryption key not found" }, 500);
		}
		
		// Generate presigned URL for download (valid for 15 minutes)
		const command = new GetObjectCommand({
			Bucket: fileRecord.s3Bucket,
			Key: fileRecord.s3Key,
		});
		
		const presignedUrl = await getSignedUrl(s3Presigner, command, {
			expiresIn: 900, // 15 minutes
		});
		
		return c.json({
			downloadUrl: presignedUrl,
			wrappedDek: fileRecord.wrappedDek,
			nonce: fileRecord.nonce,
			originalFilename: fileRecord.originalFilename,
			mimeType: fileRecord.mimeType,
		});
	}		// Check if file was directly shared with user (via fileKey)
		const [fileKeyRecord] = await db
			.select()
			.from(fileKey)
			.where(
				and(
					eq(fileKey.fileId, fileId),
					eq(fileKey.recipientUserId, userId)
				)
			)
			.limit(1);
		
		if (fileKeyRecord) {
			// Generate presigned URL for download (valid for 15 minutes)
			const command = new GetObjectCommand({
				Bucket: fileRecord.s3Bucket,
				Key: fileRecord.s3Key,
			});
			
			const presignedUrl = await getSignedUrl(s3Presigner, command, {
				expiresIn: 900, // 15 minutes
			});
			
			return c.json({
				downloadUrl: presignedUrl,
				wrappedDek: fileKeyRecord.wrappedDek, // User-specific wrapped DEK
				nonce: fileRecord.nonce,
				originalFilename: fileRecord.originalFilename,
				mimeType: fileRecord.mimeType,
			});
		}
		
		// Check if user has access through a folder
		if (fileRecord.folderId) {
			// Check if user has access to the folder
			const [folderAccess] = await db
				.select()
				.from(folderKey)
				.where(
					and(
						eq(folderKey.folderId, fileRecord.folderId),
						eq(folderKey.recipientUserId, userId)
					)
				)
				.limit(1);
			
			if (folderAccess) {
				// User has folder access, get the file-folder key
				const [fileFolderKeyRecord] = await db
					.select()
					.from(fileFolderKey)
					.where(
						and(
							eq(fileFolderKey.fileId, fileId),
							eq(fileFolderKey.folderId, fileRecord.folderId)
						)
					)
					.limit(1);
				
				if (!fileFolderKeyRecord) {
					return c.json({ error: "File encryption key not found for folder" }, 500);
				}
				
				// Generate presigned URL for download (valid for 15 minutes)
				const command = new GetObjectCommand({
					Bucket: fileRecord.s3Bucket,
					Key: fileRecord.s3Key,
				});
				
				const presignedUrl = await getSignedUrl(s3Presigner, command, {
					expiresIn: 900, // 15 minutes
				});
				
				return c.json({
					downloadUrl: presignedUrl,
					wrappedDek: fileFolderKeyRecord.wrappedDek, // DEK wrapped with folder key
					wrappingNonce: fileFolderKeyRecord.wrappingNonce,
					nonce: fileRecord.nonce,
					originalFilename: fileRecord.originalFilename,
					mimeType: fileRecord.mimeType,
				});
			}
		}
		
		// No access found
		return c.json({ error: "Access denied" }, 403);
	} catch (error) {
		console.error("Download error:", error);
		return c.json({ error: "Failed to generate download URL" }, 500);
	}
});

// DELETE /api/files/:fileId - Soft delete file (move to trash)
app.delete("/:fileId", async (c) => {
	try {
		const fileId = c.req.param("fileId");
		const userId = (c as any).get("userId") as string;
		
		const [fileRecord] = await db
			.select()
			.from(file)
			.where(and(eq(file.id, fileId), eq(file.userId, userId)))
			.limit(1);
		
		if (!fileRecord) {
			return c.json({ error: "File not found" }, 404);
		}
		
		// Get user's trash retention settings
		// TODO: Re-enable when userSettings table migration is run
		// const [settings] = await db
		// 	.select()
		// 	.from(userSettings)
		// 	.where(eq(userSettings.userId, userId))
		// 	.limit(1);
		
		// Default to 30 days retention
		const retentionDays = 30; // settings?.trashRetentionDays ?? 30;
		
		// Calculate scheduled deletion date
		let scheduledDeletion: Date | null = null;
		if (retentionDays > 0) {
			scheduledDeletion = new Date();
			scheduledDeletion.setDate(scheduledDeletion.getDate() + retentionDays);
		}
		
		// Soft delete: mark as deleted instead of removing
		await db.execute(
			sql`UPDATE file 
				SET deleted_at = NOW(), 
					deleted_by = ${userId}, 
					scheduled_deletion_at = ${scheduledDeletion}, 
					updated_at = NOW() 
				WHERE id = ${fileId}`
		);
		
		console.log(`✅ File ${fileId} moved to trash`);
		
		return c.json({ 
			success: true,
			message: "File moved to trash",
			scheduledDeletion: scheduledDeletion?.toISOString() || null,
		});
	} catch (error) {
		console.error("Delete file error:", error);
		return c.json({ error: "Failed to delete file" }, 500);
	}
});

export default app;



