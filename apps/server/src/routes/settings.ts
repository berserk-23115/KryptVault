import { Hono } from "hono";
import { db, userSettings } from "@krypt-vault/db";
import { eq, sql } from "@krypt-vault/db";
import { auth } from "@krypt-vault/auth";
import { z } from "zod";
import { v4 as uuidv4 } from "uuid";

const app = new Hono();

// Validation schemas
const updateSettingsSchema = z.object({
	trashRetentionDays: z.number().int().min(0).max(365),
});

// Middleware to extract user from session
app.use("*", async (c, next) => {
	console.log(`🔍 Settings route middleware: ${c.req.method} ${c.req.path}`);
	
	// Get session using better-auth
	const session = await auth.api.getSession({
		headers: c.req.raw.headers
	});
	
	if (!session?.user) {
		// For development: allow bypass
		const devUserId = c.req.header("x-user-id");
		
		if (devUserId) {
			console.log(`👤 Using x-user-id header: ${devUserId}`);
			(c as any).set("userId", devUserId);
		} else if (process.env.NODE_ENV === "development") {
			console.warn("⚠️ No session found. Using dev user ID: dev-user-123");
			(c as any).set("userId", "dev-user-123");
		} else {
			console.error("❌ No session and not in development mode");
			return c.json({ error: "Unauthorized" }, 401);
		}
	} else {
		console.log(`✅ Authenticated user: ${session.user.id}`);
		(c as any).set("userId", session.user.id);
	}
	
	await next();
});

// GET /api/settings - Get user settings
app.get("/", async (c) => {
	try {
		const userId = (c as any).get("userId") as string;
		
		console.log("⚙️ Getting settings for user:", userId);
		
		// Get or create user settings
		let [settings] = await db
			.select()
			.from(userSettings)
			.where(eq(userSettings.userId, userId))
			.limit(1);
		
		// Create default settings if they don't exist
		if (!settings) {
			console.log("Creating default settings for user");
			[settings] = await db
				.insert(userSettings)
				.values({
					id: uuidv4(),
					userId,
					trashRetentionDays: 30,
					createdAt: new Date(),
					updatedAt: new Date(),
				})
				.returning();
		}
		
		return c.json({ settings });
	} catch (error) {
		console.error("❌ Get settings error:", error);
		return c.json({ error: "Failed to get settings" }, 500);
	}
});

// PATCH /api/settings - Update user settings
app.patch("/", async (c) => {
	try {
		const userId = (c as any).get("userId") as string;
		const body = await c.req.json();
		
		console.log("⚙️ Updating settings for user:", userId, body);
		
		const validated = updateSettingsSchema.parse(body);
		
		// Get or create user settings
		let [settings] = await db
			.select()
			.from(userSettings)
			.where(eq(userSettings.userId, userId))
			.limit(1);
		
		if (!settings) {
			// Create new settings
			[settings] = await db
				.insert(userSettings)
				.values({
					id: uuidv4(),
					userId,
					trashRetentionDays: validated.trashRetentionDays,
					createdAt: new Date(),
					updatedAt: new Date(),
				})
				.returning();
		} else {
			// Update existing settings
			await db.execute(
				sql`UPDATE user_settings 
					SET trash_retention_days = ${validated.trashRetentionDays}, 
						updated_at = NOW() 
					WHERE user_id = ${userId}`
			);
			
			// Fetch updated settings
			[settings] = await db
				.select()
				.from(userSettings)
				.where(eq(userSettings.userId, userId))
				.limit(1);
		}
		
		console.log("✅ Settings updated successfully");
		
		return c.json({ 
			success: true,
			settings,
		});
	} catch (error) {
		console.error("❌ Update settings error:", error);
		if (error instanceof z.ZodError) {
			return c.json({ error: "Invalid settings data", details: error.issues }, 400);
		}
		return c.json({ error: "Failed to update settings" }, 500);
	}
});

export default app;
