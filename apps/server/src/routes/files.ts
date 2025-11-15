import { Hono } from "hono";
import { db, file } from "@krypt-vault/db";
import { eq, and, desc } from "@krypt-vault/db";
import { S3Client, PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { v4 as uuidv4 } from "uuid";
import { z } from "zod";
import sodium from "libsodium-wrappers";
import { auth } from "@krypt-vault/auth";

// Initialize S3 client for MinIO
const s3Client = new S3Client({
	region: process.env.AWS_REGION || "us-east-1",
	endpoint: process.env.AWS_S3_ENDPOINT || "http://localhost:9200",
	credentials: {
		accessKeyId: process.env.AWS_ACCESS_KEY_ID || "",
		secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || "",
	},
	forcePathStyle: true, // Required for MinIO
});

const BUCKET_NAME = process.env.AWS_S3_BUCKET || "krypt-vault-files";

// Server keypair for sealing/unsealing DEKs (should be stored securely in production)
let SERVER_PUBLIC_KEY: string;
let SERVER_PRIVATE_KEY: string;

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
	wrappedDek: z.string(),
	nonce: z.string(),
	originalFilename: z.string(),
	fileSize: z.number(),
	mimeType: z.string().optional(),
	description: z.string().optional(),
	tags: z.array(z.string()).optional(),
});

const downloadRequestSchema = z.object({
	fileId: z.string(),
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

// POST /api/files/upload/init - Initialize file upload and get presigned URL
app.post("/upload/init", async (c) => {
	try {
		const body = await c.req.json();
		console.log("📤 Upload init request:", body);
		
		const validated = uploadRequestSchema.parse(body);
		const userId = (c as any).get("userId") as string;
		
		console.log("👤 User ID:", userId);
		
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
		
		const presignedUrl = await getSignedUrl(s3Client, command, {
			expiresIn: 900, // 15 minutes
		});
		
		console.log("✅ Presigned URL generated successfully");
		
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
		
		// Store file metadata in database
		await db.insert(file).values({
			id: data.fileId,
			userId,
			originalFilename: data.originalFilename,
			mimeType: data.mimeType || "application/octet-stream",
			fileSize: data.fileSize,
			s3Key: data.s3Key,
			s3Bucket: BUCKET_NAME,
			wrappedDek: data.wrappedDek,
			nonce: data.nonce,
			description: data.description,
			tags: data.tags,
			createdAt: new Date(),
			updatedAt: new Date(),
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

// GET /api/files or /api/files/ - List user's files
// IMPORTANT: This must come BEFORE the /:fileId route to avoid conflicts
app.get("/", async (c) => {
	try {
		const userId = (c as any).get("userId") as string;
		
		console.log("📋 Listing files for user:", userId);
		
		const files = await db
			.select()
			.from(file)
			.where(eq(file.userId, userId))
			.orderBy(desc(file.createdAt));
		
		console.log(`✅ Found ${files.length} files`);
		
		return c.json({ files });
	} catch (error) {
		console.error("❌ List files error:", error);
		return c.json({ error: "Failed to list files" }, 500);
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
		
		const [fileRecord] = await db
			.select()
			.from(file)
			.where(and(eq(file.id, fileId), eq(file.userId, userId)))
			.limit(1);
		
		if (!fileRecord) {
			return c.json({ error: "File not found" }, 404);
		}
		
		// Generate presigned URL for download (valid for 15 minutes)
		const command = new GetObjectCommand({
			Bucket: fileRecord.s3Bucket,
			Key: fileRecord.s3Key,
		});
		
		const presignedUrl = await getSignedUrl(s3Client, command, {
			expiresIn: 900, // 15 minutes
		});
		
		return c.json({
			downloadUrl: presignedUrl,
			wrappedDek: fileRecord.wrappedDek,
			nonce: fileRecord.nonce,
			originalFilename: fileRecord.originalFilename,
			mimeType: fileRecord.mimeType,
			serverPublicKey: SERVER_PUBLIC_KEY,
			serverPrivateKey: SERVER_PRIVATE_KEY, // ⚠️ SECURITY: In production, decrypt on server side!
		});
	} catch (error) {
		console.error("Download error:", error);
		return c.json({ error: "Failed to generate download URL" }, 500);
	}
});

// DELETE /api/files/:fileId - Delete file
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
		
		// Delete from S3 (you might want to implement this)
		// await s3Client.send(new DeleteObjectCommand({
		//   Bucket: fileRecord.s3Bucket,
		//   Key: fileRecord.s3Key,
		// }));
		
		// Delete from database
		await db.delete(file).where(eq(file.id, fileId));
		
		return c.json({ success: true });
	} catch (error) {
		console.error("Delete file error:", error);
		return c.json({ error: "Failed to delete file" }, 500);
	}
});

export default app;
