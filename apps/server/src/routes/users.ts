import { Hono } from "hono";
import { db, user, userKeypair } from "@krypt-vault/db";
import { eq } from "@krypt-vault/db";
import { z } from "zod";
import { auth } from "@krypt-vault/auth";

const app = new Hono();

// Validation schemas
const registerKeypairSchema = z.object({
	x25519PublicKey: z.string(),
	ed25519PublicKey: z.string(),
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
			// In development, if no session, require authentication
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

// POST /api/users/keypair - Register user's public keys
app.post("/keypair", async (c) => {
	try {
		const body = await c.req.json();
		const validated = registerKeypairSchema.parse(body);
		const userId = (c as any).get("userId") as string;
		
		// Check if keypair already exists
		const [existing] = await db
			.select()
			.from(userKeypair)
			.where(eq(userKeypair.userId, userId))
			.limit(1);
		
		if (existing) {
			return c.json({ error: "Keypair already registered" }, 400);
		}
		
		// Insert new keypair
		const [keypair] = await db
			.insert(userKeypair)
			.values({
				id: crypto.randomUUID(),
				userId,
				x25519PublicKey: validated.x25519PublicKey,
				ed25519PublicKey: validated.ed25519PublicKey,
				createdAt: new Date(),
				updatedAt: new Date(),
			})
			.returning();
		
		return c.json({
			success: true,
			keypair: {
				x25519PublicKey: keypair?.x25519PublicKey,
				ed25519PublicKey: keypair?.ed25519PublicKey,
			},
		});
	} catch (error) {
		console.error("Register keypair error:", error);
		return c.json({ 
			error: "Failed to register keypair",
			details: error instanceof Error ? error.message : String(error)
		}, 500);
	}
});

// GET /api/users/keypair - Get current user's public keys
app.get("/keypair", async (c) => {
	try {
		const userId = (c as any).get("userId") as string;
		
		const [keypair] = await db
			.select()
			.from(userKeypair)
			.where(eq(userKeypair.userId, userId))
			.limit(1);
		
		if (!keypair) {
			return c.json({ error: "Keypair not found" }, 404);
		}
		
		return c.json({
			x25519PublicKey: keypair.x25519PublicKey,
			ed25519PublicKey: keypair.ed25519PublicKey,
		});
	} catch (error) {
		console.error("Get keypair error:", error);
		return c.json({ error: "Failed to get keypair" }, 500);
	}
});

// GET /api/users/:userId/public-key - Get another user's X25519 public key for sharing
app.get("/:userId/public-key", async (c) => {
	try {
		const targetUserId = c.req.param("userId");
		
		const [keypair] = await db
			.select({
				x25519PublicKey: userKeypair.x25519PublicKey,
				userName: user.name,
				userEmail: user.email,
			})
			.from(userKeypair)
			.innerJoin(user, eq(userKeypair.userId, user.id))
			.where(eq(userKeypair.userId, targetUserId))
			.limit(1);
		
		if (!keypair) {
			return c.json({ error: "User keypair not found" }, 404);
		}
		
		return c.json({
			userId: targetUserId,
			x25519PublicKey: keypair.x25519PublicKey,
			userName: keypair.userName,
			userEmail: keypair.userEmail,
		});
	} catch (error) {
		console.error("Get public key error:", error);
		return c.json({ error: "Failed to get public key" }, 500);
	}
});

// GET /api/users/search - Search users by email for sharing
app.get("/search", async (c) => {
	try {
		const email = c.req.query("email");
		
		if (!email) {
			return c.json({ error: "Email query parameter required" }, 400);
		}
		
		const users = await db
			.select({
				userId: user.id,
				name: user.name,
				email: user.email,
				image: user.image,
				hasKeypair: userKeypair.id,
			})
			.from(user)
			.leftJoin(userKeypair, eq(user.id, userKeypair.userId))
			.where(eq(user.email, email))
			.limit(10);
		
		return c.json({ users });
	} catch (error) {
		console.error("Search users error:", error);
		return c.json({ error: "Failed to search users" }, 500);
	}
});

export default app;
