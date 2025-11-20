import { Hono } from "hono";
import { db, file, fileKey, user, userKeypair } from "@krypt-vault/db";
import { eq, and } from "@krypt-vault/db";
import { z } from "zod";
import { auth } from "@krypt-vault/auth";

const app = new Hono();

// Validation schemas
const shareFileSchema = z.object({
	fileId: z.string(),
	recipientUserId: z.string(),
	wrappedDek: z.string(), // DEK wrapped with recipient's public key
});

const shareBulkSchema = z.object({
	fileId: z.string(),
	recipients: z.array(z.object({
		userId: z.string(),
		wrappedDek: z.string(),
	})),
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

// POST /api/sharing/share - Share a file with another user
app.post("/share", async (c) => {
	try {
		const body = await c.req.json();
		const validated = shareFileSchema.parse(body);
		const sharingUserId = (c as any).get("userId") as string;
		
		// Verify the file exists and user has access
		const [fileRecord] = await db
			.select()
			.from(file)
			.where(eq(file.id, validated.fileId))
			.limit(1);
		
		if (!fileRecord) {
			return c.json({ error: "File not found" }, 404);
		}
		
		// Check if user has access to this file
		const hasAccess = fileRecord.userId === sharingUserId || 
			await checkUserHasFileAccess(validated.fileId, sharingUserId);
		
		if (!hasAccess) {
			return c.json({ error: "You don't have access to this file" }, 403);
		}
		
		// Verify recipient exists and has a keypair
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
			.from(fileKey)
			.where(
				and(
					eq(fileKey.fileId, validated.fileId),
					eq(fileKey.recipientUserId, validated.recipientUserId)
				)
			)
			.limit(1);
		
		if (existing) {
			return c.json({ error: "File already shared with this user" }, 400);
		}
		
		// Create file key entry
		await db.insert(fileKey).values({
			id: crypto.randomUUID(),
			fileId: validated.fileId,
			recipientUserId: validated.recipientUserId,
			wrappedDek: validated.wrappedDek,
			sharedBy: sharingUserId,
			createdAt: new Date(),
		});
		
		return c.json({
			success: true,
			message: "File shared successfully",
		});
	} catch (error) {
		console.error("Share file error:", error);
		return c.json({ 
			error: "Failed to share file",
			details: error instanceof Error ? error.message : String(error)
		}, 500);
	}
});

// POST /api/sharing/share-bulk - Share a file with multiple users at once
app.post("/share-bulk", async (c) => {
	try {
		const body = await c.req.json();
		const validated = shareBulkSchema.parse(body);
		const sharingUserId = (c as any).get("userId") as string;
		
		// Verify the file exists and user has access
		const [fileRecord] = await db
			.select()
			.from(file)
			.where(eq(file.id, validated.fileId))
			.limit(1);
		
		if (!fileRecord) {
			return c.json({ error: "File not found" }, 404);
		}
		
		const hasAccess = fileRecord.userId === sharingUserId || 
			await checkUserHasFileAccess(validated.fileId, sharingUserId);
		
		if (!hasAccess) {
			return c.json({ error: "You don't have access to this file" }, 403);
		}
		
		// Insert all shares
		const shares = validated.recipients.map(recipient => ({
			id: crypto.randomUUID(),
			fileId: validated.fileId,
			recipientUserId: recipient.userId,
			wrappedDek: recipient.wrappedDek,
			sharedBy: sharingUserId,
			createdAt: new Date(),
		}));
		
		await db.insert(fileKey).values(shares);
		
		return c.json({
			success: true,
			sharedCount: shares.length,
		});
	} catch (error) {
		console.error("Bulk share error:", error);
		return c.json({ 
			error: "Failed to share file",
			details: error instanceof Error ? error.message : String(error)
		}, 500);
	}
});

// DELETE /api/sharing/revoke - Revoke access to a file
app.delete("/revoke", async (c) => {
	try {
		const fileId = c.req.query("fileId");
		const recipientUserId = c.req.query("recipientUserId");
		const userId = (c as any).get("userId") as string;
		
		if (!fileId || !recipientUserId) {
			return c.json({ error: "fileId and recipientUserId required" }, 400);
		}
		
		// Verify user owns the file or is the one who shared it
		const [fileRecord] = await db
			.select()
			.from(file)
			.where(eq(file.id, fileId))
			.limit(1);
		
		if (!fileRecord) {
			return c.json({ error: "File not found" }, 404);
		}
		
		if (fileRecord.userId !== userId) {
			// Check if user was the one who shared it
			const [shareRecord] = await db
				.select()
				.from(fileKey)
				.where(
					and(
						eq(fileKey.fileId, fileId),
						eq(fileKey.recipientUserId, recipientUserId),
						eq(fileKey.sharedBy, userId)
					)
				)
				.limit(1);
			
			if (!shareRecord) {
				return c.json({ error: "You don't have permission to revoke this access" }, 403);
			}
		}
		
		// Delete the file key
		await db
			.delete(fileKey)
			.where(
				and(
					eq(fileKey.fileId, fileId),
					eq(fileKey.recipientUserId, recipientUserId)
				)
			);
		
		return c.json({
			success: true,
			message: "Access revoked successfully",
		});
	} catch (error) {
		console.error("Revoke access error:", error);
		return c.json({ error: "Failed to revoke access" }, 500);
	}
});

// GET /api/sharing/shared-with-me - List files shared with current user
app.get("/shared-with-me", async (c) => {
	try {
		const userId = (c as any).get("userId") as string;
		
		const sharedFiles = await db
			.select({
				fileId: file.id,
				originalFilename: file.originalFilename,
				mimeType: file.mimeType,
				fileSize: file.fileSize,
				s3Key: file.s3Key,
				s3Bucket: file.s3Bucket,
				nonce: file.nonce,
				wrappedDek: fileKey.wrappedDek,
				sharedBy: user.name,
				sharedByEmail: user.email,
				sharedAt: fileKey.createdAt,
				sharedById: fileKey.sharedBy,
			})
			.from(fileKey)
			.innerJoin(file, eq(fileKey.fileId, file.id))
			.innerJoin(user, eq(fileKey.sharedBy, user.id))
			.where(eq(fileKey.recipientUserId, userId));
		
		// Filter out files where the user shared with themselves
		const filteredFiles = sharedFiles.filter(
			file => file.sharedById !== userId
		);
		
		return c.json({ files: filteredFiles });
	} catch (error) {
		console.error("List shared files error:", error);
		return c.json({ error: "Failed to list shared files" }, 500);
	}
});

// GET /api/sharing/shared-by-me - List files the current user has shared
app.get("/shared-by-me", async (c) => {
	try {
		const userId = (c as any).get("userId") as string;
		
		const sharedFiles = await db
			.select({
				fileId: file.id,
				originalFilename: file.originalFilename,
				recipientUserId: fileKey.recipientUserId,
				recipientName: user.name,
				recipientEmail: user.email,
				sharedAt: fileKey.createdAt,
			})
			.from(fileKey)
			.innerJoin(file, eq(fileKey.fileId, file.id))
			.innerJoin(user, eq(fileKey.recipientUserId, user.id))
			.where(eq(fileKey.sharedBy, userId));
		
		// Filter out shares where the user shared with themselves
		const filteredShares = sharedFiles.filter(
			share => share.recipientUserId !== userId
		);
		
		return c.json({ shares: filteredShares });
	} catch (error) {
		console.error("List shared by me error:", error);
		return c.json({ error: "Failed to list shares" }, 500);
	}
});

// GET /api/sharing/:fileId/access-list - Get list of users with access to a file
app.get("/:fileId/access-list", async (c) => {
	try {
		const fileId = c.req.param("fileId");
		const userId = (c as any).get("userId") as string;
		
		// Verify user has access to the file
		const [fileRecord] = await db
			.select()
			.from(file)
			.where(eq(file.id, fileId))
			.limit(1);
		
		if (!fileRecord) {
			return c.json({ error: "File not found" }, 404);
		}
		
		const hasAccess = fileRecord.userId === userId || 
			await checkUserHasFileAccess(fileId, userId);
		
		if (!hasAccess) {
			return c.json({ error: "You don't have access to this file" }, 403);
		}
		
		// Get all users with access
		const accessList = await db
			.select({
				userId: user.id,
				name: user.name,
				email: user.email,
				sharedBy: fileKey.sharedBy,
				sharedAt: fileKey.createdAt,
			})
			.from(fileKey)
			.innerJoin(user, eq(fileKey.recipientUserId, user.id))
			.where(eq(fileKey.fileId, fileId));
		
		// Add owner
		const [owner] = await db
			.select({
				userId: user.id,
				name: user.name,
				email: user.email,
			})
			.from(user)
			.where(eq(user.id, fileRecord.userId))
			.limit(1);
		
		return c.json({
			owner,
			sharedWith: accessList,
		});
	} catch (error) {
		console.error("Get access list error:", error);
		return c.json({ error: "Failed to get access list" }, 500);
	}
});

// Helper function to check if user has access to a file
async function checkUserHasFileAccess(fileId: string, userId: string): Promise<boolean> {
	const [access] = await db
		.select()
		.from(fileKey)
		.where(
			and(
				eq(fileKey.fileId, fileId),
				eq(fileKey.recipientUserId, userId)
			)
		)
		.limit(1);
	
	return !!access;
}

export default app;
