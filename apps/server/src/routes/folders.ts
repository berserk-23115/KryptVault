import { Hono } from "hono";
import { db, folder, folderKey, file, fileFolderKey, user, userKeypair } from "@krypt-vault/db";
import { eq, and, sql } from "@krypt-vault/db";
import { z } from "zod";
import { auth } from "@krypt-vault/auth";

const app = new Hono();

// Validation schemas
const createFolderSchema = z.object({
	name: z.string(),
	description: z.string().optional(),
	parentFolderId: z.string().optional(),
	wrappedFolderKey: z.string(), // Folder key wrapped with owner's public key
});

const shareFolderSchema = z.object({
	folderId: z.string(),
	recipientUserId: z.string(),
	wrappedFolderKey: z.string(), // Folder key wrapped with recipient's public key
});

const addFileToFolderSchema = z.object({
	fileId: z.string(),
	folderId: z.string(),
	wrappedDek: z.string(), // File DEK wrapped with folder key
	wrappingNonce: z.string(),
});

// Middleware to extract user from session
app.use("*", async (c, next) => {
	const session = await auth.api.getSession({
		headers: c.req.raw.headers
	});
	
	if (!session?.user) {
		const devUserId = c.req.header("x-user-id");
		
		if (devUserId) {
			(c as any).set("userId", devUserId);
		} else if (process.env.NODE_ENV === "development") {
			console.warn("⚠️ No session found. User must be logged in to use sharing features.");
			return c.json({ 
				error: "Unauthorized - Please log in first",
				hint: "Sharing features require authentication"
			}, 401);
		} else {
			return c.json({ error: "Unauthorized" }, 401);
		}
	} else {
		(c as any).set("userId", session.user.id);
	}
	
	await next();
});

// POST /api/folders - Create a new folder
app.post("/", async (c) => {
	try {
		const body = await c.req.json();
		const validated = createFolderSchema.parse(body);
		const userId = (c as any).get("userId") as string;
		
		const folderId = crypto.randomUUID();
		
		// Create folder
		await db.insert(folder).values({
			id: folderId,
			ownerId: userId,
			name: validated.name,
			description: validated.description,
			parentFolderId: validated.parentFolderId,
			createdAt: new Date(),
			updatedAt: new Date(),
		});
		
		// Store folder key for owner
		await db.insert(folderKey).values({
			id: crypto.randomUUID(),
			folderId,
			recipientUserId: userId,
			wrappedFolderKey: validated.wrappedFolderKey,
			sharedBy: userId,
			createdAt: new Date(),
		});
		
		return c.json({
			success: true,
			folderId,
		});
	} catch (error) {
		console.error("Create folder error:", error);
		return c.json({ 
			error: "Failed to create folder",
			details: error instanceof Error ? error.message : String(error)
		}, 500);
	}
});

// GET /api/folders - List user's folders
app.get("/", async (c) => {
	try {
		const userId = (c as any).get("userId") as string;
		
		// Get folders owned by user or shared with user
		const folders = await db
			.select({
				folderId: folder.id,
				name: folder.name,
				description: folder.description,
				parentFolderId: folder.parentFolderId,
				ownerId: folder.ownerId,
				ownerName: user.name,
				wrappedFolderKey: folderKey.wrappedFolderKey,
				createdAt: folder.createdAt,
			})
			.from(folderKey)
			.innerJoin(folder, eq(folderKey.folderId, folder.id))
			.innerJoin(user, eq(folder.ownerId, user.id))
			.where(eq(folderKey.recipientUserId, userId));
		
		return c.json({ folders });
	} catch (error) {
		console.error("List folders error:", error);
		return c.json({ error: "Failed to list folders" }, 500);
	}
});

// GET /api/folders/shared/with-me - List folders shared with the current user
app.get("/shared/with-me", async (c) => {
	try {
		const userId = (c as any).get("userId") as string;
		
		// Get folders shared with user (not owned by user)
		const folders = await db
			.select({
				folderId: folder.id,
				name: folder.name,
				description: folder.description,
				parentFolderId: folder.parentFolderId,
				ownerId: folder.ownerId,
				ownerName: user.name,
				ownerEmail: user.email,
				wrappedFolderKey: folderKey.wrappedFolderKey,
				sharedBy: folderKey.sharedBy,
				sharedAt: folderKey.createdAt,
				createdAt: folder.createdAt,
			})
			.from(folderKey)
			.innerJoin(folder, eq(folderKey.folderId, folder.id))
			.innerJoin(user, eq(folder.ownerId, user.id))
			.where(
				and(
					eq(folderKey.recipientUserId, userId),
					// Exclude folders owned by the user
					(sql`${folder.ownerId} != ${userId}`)
				)
			);
		
		return c.json({ folders });
	} catch (error) {
		console.error("List shared folders error:", error);
		return c.json({ error: "Failed to list shared folders" }, 500);
	}
});

// GET /api/folders/shared/by-me - List folders shared by the current user with others
app.get("/shared/by-me", async (c) => {
	try {
		const userId = (c as any).get("userId") as string;
		
		// Get folders owned by user and shared with others
		const sharedFolders = await db
			.select({
				folderId: folder.id,
				folderName: folder.name,
				recipientUserId: user.id,
				recipientName: user.name,
				recipientEmail: user.email,
				sharedAt: folderKey.createdAt,
			})
			.from(folder)
			.innerJoin(folderKey, eq(folder.id, folderKey.folderId))
			.innerJoin(user, eq(folderKey.recipientUserId, user.id))
			.where(
				and(
					eq(folder.ownerId, userId),
					// Exclude the owner's own access entry
					(sql`${folderKey.recipientUserId} != ${userId}`)
				)
			);
		
		return c.json({ shares: sharedFolders });
	} catch (error) {
		console.error("List folders shared by me error:", error);
		return c.json({ error: "Failed to list folders shared by me" }, 500);
	}
});

// GET /api/folders/:folderId - Get folder details
app.get("/:folderId", async (c) => {
	try {
		const folderId = c.req.param("folderId");
		const userId = (c as any).get("userId") as string;
		
		// Check if user has access
		const [folderAccess] = await db
			.select({
				folderId: folder.id,
				name: folder.name,
				description: folder.description,
				parentFolderId: folder.parentFolderId,
				ownerId: folder.ownerId,
				ownerName: user.name,
				ownerEmail: user.email,
				wrappedFolderKey: folderKey.wrappedFolderKey,
			})
			.from(folderKey)
			.innerJoin(folder, eq(folderKey.folderId, folder.id))
			.innerJoin(user, eq(folder.ownerId, user.id))
			.where(
				and(
					eq(folderKey.folderId, folderId),
					eq(folderKey.recipientUserId, userId)
				)
			)
			.limit(1);
		
		if (!folderAccess) {
			return c.json({ error: "Folder not found or access denied" }, 404);
		}
		
		// Get files in folder
		const files = await db
			.select({
				fileId: file.id,
				originalFilename: file.originalFilename,
				mimeType: file.mimeType,
				fileSize: file.fileSize,
				wrappedDek: fileFolderKey.wrappedDek,
				wrappingNonce: fileFolderKey.wrappingNonce,
				s3Key: file.s3Key,
				s3Bucket: file.s3Bucket,
				nonce: file.nonce,
				createdAt: file.createdAt,
			})
			.from(fileFolderKey)
			.innerJoin(file, eq(fileFolderKey.fileId, file.id))
			.where(eq(fileFolderKey.folderId, folderId));
		
		return c.json({
			folder: folderAccess,
			files,
		});
	} catch (error) {
		console.error("Get folder error:", error);
		return c.json({ error: "Failed to get folder" }, 500);
	}
});

// POST /api/folders/:folderId/share - Share folder with another user
app.post("/:folderId/share", async (c) => {
	try {
		const folderId = c.req.param("folderId");
		const body = await c.req.json();
		const validated = shareFolderSchema.parse({ ...body, folderId });
		const sharingUserId = (c as any).get("userId") as string;
		
		// Verify folder exists and user has access
		const [folderRecord] = await db
			.select()
			.from(folder)
			.where(eq(folder.id, folderId))
			.limit(1);
		
		if (!folderRecord) {
			return c.json({ error: "Folder not found" }, 404);
		}
		
		const hasAccess = folderRecord.ownerId === sharingUserId || 
			await checkUserHasFolderAccess(folderId, sharingUserId);
		
		if (!hasAccess) {
			return c.json({ error: "You don't have access to this folder" }, 403);
		}
		
		// Verify recipient exists and has keypair
		const [recipient] = await db
			.select()
			.from(userKeypair)
			.where(eq(userKeypair.userId, validated.recipientUserId))
			.limit(1);
		
		if (!recipient) {
			return c.json({ error: "Recipient not found or hasn't set up encryption" }, 404);
		}
		
		// Check if already shared
		const [existing] = await db
			.select()
			.from(folderKey)
			.where(
				and(
					eq(folderKey.folderId, folderId),
					eq(folderKey.recipientUserId, validated.recipientUserId)
				)
			)
			.limit(1);
		
		if (existing) {
			return c.json({ error: "Folder already shared with this user" }, 400);
		}
		
		// Create folder key entry
		await db.insert(folderKey).values({
			id: crypto.randomUUID(),
			folderId,
			recipientUserId: validated.recipientUserId,
			wrappedFolderKey: validated.wrappedFolderKey,
			sharedBy: sharingUserId,
			createdAt: new Date(),
		});
		
		return c.json({
			success: true,
			message: "Folder shared successfully",
		});
	} catch (error) {
		console.error("Share folder error:", error);
		return c.json({ 
			error: "Failed to share folder",
			details: error instanceof Error ? error.message : String(error)
		}, 500);
	}
});

// DELETE /api/folders/:folderId/revoke - Revoke folder access
app.delete("/:folderId/revoke", async (c) => {
	try {
		const folderId = c.req.param("folderId");
		const recipientUserId = c.req.query("recipientUserId");
		const userId = (c as any).get("userId") as string;
		
		if (!recipientUserId) {
			return c.json({ error: "recipientUserId required" }, 400);
		}
		
		// Verify user owns the folder
		const [folderRecord] = await db
			.select()
			.from(folder)
			.where(eq(folder.id, folderId))
			.limit(1);
		
		if (!folderRecord) {
			return c.json({ error: "Folder not found" }, 404);
		}
		
		if (folderRecord.ownerId !== userId) {
			return c.json({ error: "Only folder owner can revoke access" }, 403);
		}
		
		// Delete the folder key
		await db
			.delete(folderKey)
			.where(
				and(
					eq(folderKey.folderId, folderId),
					eq(folderKey.recipientUserId, recipientUserId)
				)
			);
		
		return c.json({
			success: true,
			message: "Folder access revoked successfully",
		});
	} catch (error) {
		console.error("Revoke folder access error:", error);
		return c.json({ error: "Failed to revoke folder access" }, 500);
	}
});

// POST /api/folders/:folderId/files - Add file to folder
app.post("/:folderId/files", async (c) => {
	try {
		const folderId = c.req.param("folderId");
		const body = await c.req.json();
		const validated = addFileToFolderSchema.parse({ ...body, folderId });
		const userId = (c as any).get("userId") as string;
		
		// Verify user has access to folder
		const hasAccess = await checkUserHasFolderAccess(folderId, userId);
		
		if (!hasAccess) {
			return c.json({ error: "You don't have access to this folder" }, 403);
		}
		
		// Verify file exists and user owns it
		const [fileRecord] = await db
			.select()
			.from(file)
			.where(
				and(
					eq(file.id, validated.fileId),
					eq(file.userId, userId)
				)
			)
			.limit(1);
		
		if (!fileRecord) {
			return c.json({ error: "File not found or access denied" }, 404);
		}
		
		// Update file's folderId
		await db
			.update(file)
			.set({ folderId })
			.where(eq(file.id, validated.fileId));
		
		// Create file folder key entry
		await db.insert(fileFolderKey).values({
			id: crypto.randomUUID(),
			fileId: validated.fileId,
			folderId,
			wrappedDek: validated.wrappedDek,
			wrappingNonce: validated.wrappingNonce,
			createdAt: new Date(),
		});
		
		return c.json({
			success: true,
			message: "File added to folder successfully",
		});
	} catch (error) {
		console.error("Add file to folder error:", error);
		return c.json({ 
			error: "Failed to add file to folder",
			details: error instanceof Error ? error.message : String(error)
		}, 500);
	}
});

// DELETE /api/folders/:folderId/files/:fileId - Remove file from folder
app.delete("/:folderId/files/:fileId", async (c) => {
	try {
		const folderId = c.req.param("folderId");
		const fileId = c.req.param("fileId");
		const userId = (c as any).get("userId") as string;
		
		// Verify file exists and user owns it
		const [fileRecord] = await db
			.select()
			.from(file)
			.where(
				and(
					eq(file.id, fileId),
					eq(file.userId, userId)
				)
			)
			.limit(1);
		
		if (!fileRecord) {
			return c.json({ error: "File not found or access denied" }, 404);
		}
		
		// Remove from folder
		await db
			.update(file)
			.set({ folderId: null })
			.where(eq(file.id, fileId));
		
		// Delete file folder key entry
		await db
			.delete(fileFolderKey)
			.where(
				and(
					eq(fileFolderKey.fileId, fileId),
					eq(fileFolderKey.folderId, folderId)
				)
			);
		
		return c.json({
			success: true,
			message: "File removed from folder successfully",
		});
	} catch (error) {
		console.error("Remove file from folder error:", error);
		return c.json({ error: "Failed to remove file from folder" }, 500);
	}
});

// GET /api/folders/:folderId/access-list - Get list of users with access to folder
app.get("/:folderId/access-list", async (c) => {
	try {
		const folderId = c.req.param("folderId");
		const userId = (c as any).get("userId") as string;
		
		// Verify user has access to the folder
		const [folderRecord] = await db
			.select()
			.from(folder)
			.where(eq(folder.id, folderId))
			.limit(1);
		
		if (!folderRecord) {
			return c.json({ error: "Folder not found" }, 404);
		}
		
		const hasAccess = folderRecord.ownerId === userId || 
			await checkUserHasFolderAccess(folderId, userId);
		
		if (!hasAccess) {
			return c.json({ error: "You don't have access to this folder" }, 403);
		}
		
		// Get all users with access
		const accessList = await db
			.select({
				userId: user.id,
				name: user.name,
				email: user.email,
				sharedBy: folderKey.sharedBy,
				sharedAt: folderKey.createdAt,
			})
			.from(folderKey)
			.innerJoin(user, eq(folderKey.recipientUserId, user.id))
			.where(eq(folderKey.folderId, folderId));
		
		// Get owner
		const [owner] = await db
			.select({
				userId: user.id,
				name: user.name,
				email: user.email,
			})
			.from(user)
			.where(eq(user.id, folderRecord.ownerId))
			.limit(1);
		
		return c.json({
			owner,
			sharedWith: accessList,
		});
	} catch (error) {
		console.error("Get folder access list error:", error);
		return c.json({ error: "Failed to get access list" }, 500);
	}
});

// DELETE /api/folders/:folderId - Delete a folder and all its contents
app.delete("/:folderId", async (c) => {
	try {
		const folderId = c.req.param("folderId");
		const userId = (c as any).get("userId") as string;
		
		// Verify folder exists and user owns it
		const [folderRecord] = await db
			.select()
			.from(folder)
			.where(eq(folder.id, folderId))
			.limit(1);
		
		if (!folderRecord) {
			return c.json({ error: "Folder not found" }, 404);
		}
		
		if (folderRecord.ownerId !== userId) {
			return c.json({ error: "Only folder owner can delete the folder" }, 403);
		}
		
		// Get all files in the folder
		const filesInFolder = await db
			.select()
			.from(file)
			.where(eq(file.folderId, folderId));
		
		// Delete all file-folder key entries for this folder
		await db
			.delete(fileFolderKey)
			.where(eq(fileFolderKey.folderId, folderId));
		
		// Update all files to remove folderId (or delete them if you want)
		// For now, we'll just remove the folder association
		await db
			.update(file)
			.set({ folderId: null })
			.where(eq(file.folderId, folderId));
		
		// Delete all folder key entries
		await db
			.delete(folderKey)
			.where(eq(folderKey.folderId, folderId));
		
		// Delete the folder itself
		await db
			.delete(folder)
			.where(eq(folder.id, folderId));
		
		return c.json({
			success: true,
			message: "Folder deleted successfully",
			filesAffected: filesInFolder.length,
		});
	} catch (error) {
		console.error("Delete folder error:", error);
		return c.json({ 
			error: "Failed to delete folder",
			details: error instanceof Error ? error.message : String(error)
		}, 500);
	}
});

// Helper function
async function checkUserHasFolderAccess(folderId: string, userId: string): Promise<boolean> {
	const [access] = await db
		.select()
		.from(folderKey)
		.where(
			and(
				eq(folderKey.folderId, folderId),
				eq(folderKey.recipientUserId, userId)
			)
		)
		.limit(1);
	
	return !!access;
}

export default app;
