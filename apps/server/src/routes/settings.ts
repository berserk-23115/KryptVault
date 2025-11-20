import { Hono } from "hono";
import { db, userSettings, securityQuestion } from "@krypt-vault/db";
import { eq, sql, and } from "@krypt-vault/db";
import { auth } from "@krypt-vault/auth";
import { z } from "zod";
import { v4 as uuidv4 } from "uuid";
import { scrypt, randomBytes, timingSafeEqual } from "crypto";
import { promisify } from "util";

const scryptAsync = promisify(scrypt);

const app = new Hono();

// Validation schemas
const updateSettingsSchema = z.object({
	trashRetentionDays: z.number().int().min(0).max(365),
});

// Middleware to extract user from session
app.use("*", async (c, next) => {
	console.log(`🔍 Settings route middleware: ${c.req.method} ${c.req.path}`);
	console.log(`📦 Headers:`, Object.fromEntries(c.req.raw.headers));
	
	try {
		// Get session using better-auth
		const session = await auth.api.getSession({
			headers: c.req.raw.headers
		});
		
		console.log(`🔑 Session result:`, { 
			hasSession: !!session,
			hasUser: !!session?.user,
			userId: session?.user?.id
		});
		
		if (session?.user) {
			console.log(`✅ Authenticated user: ${session.user.id}`);
			(c as any).set("userId", session.user.id);
		} else {
			// For development: allow bypass with x-user-id header
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
		}
	} catch (err) {
		console.error("❌ Session extraction error:", err);
		return c.json({ error: "Session error" }, 500);
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

// Helper functions for password hashing (using scrypt)
async function hashAnswer(answer: string): Promise<string> {
	const salt = randomBytes(16).toString("hex");
	const buf = (await scryptAsync(answer.toLowerCase().trim(), salt, 64)) as Buffer;
	return `${buf.toString("hex")}.${salt}`;
}

async function verifyAnswer(storedHash: string, suppliedAnswer: string): Promise<boolean> {
	const [hashedAnswer, salt] = storedHash.split(".");
	if (!hashedAnswer || !salt) {
		return false;
	}
	const hashedAnswerBuf = Buffer.from(hashedAnswer, "hex");
	const suppliedBuf = (await scryptAsync(suppliedAnswer.toLowerCase().trim(), salt, 64)) as Buffer;
	return timingSafeEqual(hashedAnswerBuf, suppliedBuf);
}

// Validation schemas for security questions
const addSecurityQuestionSchema = z.object({
	question: z.string().min(10, "Question must be at least 10 characters").max(500),
	answer: z.string().min(2, "Answer must be at least 2 characters").max(200),
});

const verifySecurityAnswerSchema = z.object({
	questionId: z.string(),
	answer: z.string(),
});

const getQuestionsForRecoverySchema = z.object({
	email: z.string().email(),
});

const verifyRecoveryAnswersSchema = z.object({
	email: z.string().email(),
	answers: z.array(z.object({
		questionId: z.string(),
		answer: z.string(),
	})).min(1),
});

const resetPasswordSchema = z.object({
	email: z.string().email(),
	newPassword: z.string().min(8),
	recoveryToken: z.string(),
});

// GET /api/settings/security-questions - Get user's security questions (without answers)
app.get("/security-questions", async (c) => {
	try {
		const userId = (c as any).get("userId") as string;
		
		console.log("🔐 Getting security questions for user:", userId);
		
		const questions = await db
			.select({
				id: securityQuestion.id,
				question: securityQuestion.question,
				createdAt: securityQuestion.createdAt,
				updatedAt: securityQuestion.updatedAt,
			})
			.from(securityQuestion)
			.where(eq(securityQuestion.userId, userId));
		
		return c.json({ questions });
	} catch (error) {
		console.error("❌ Get security questions error:", error);
		return c.json({ error: "Failed to get security questions" }, 500);
	}
});

// POST /api/settings/security-questions - Add a new security question
app.post("/security-questions", async (c) => {
	try {
		const userId = (c as any).get("userId") as string;
		const body = await c.req.json();
		
		console.log("🔐 Adding security question for user:", userId);
		
		const validated = addSecurityQuestionSchema.parse(body);
		
		// Check if user already has 3 or more questions (limit)
		const existingQuestions = await db
			.select()
			.from(securityQuestion)
			.where(eq(securityQuestion.userId, userId));
		
		if (existingQuestions.length >= 5) {
			return c.json({ error: "Maximum of 5 security questions allowed" }, 400);
		}
		
		// Hash the answer
		const answerHash = await hashAnswer(validated.answer);
		
		// Create the security question
		const [newQuestion] = await db
			.insert(securityQuestion)
			.values({
				id: uuidv4(),
				userId,
				question: validated.question,
				answerHash,
				createdAt: new Date(),
				updatedAt: new Date(),
			})
			.returning({
				id: securityQuestion.id,
				question: securityQuestion.question,
				createdAt: securityQuestion.createdAt,
				updatedAt: securityQuestion.updatedAt,
			});
		
		console.log("✅ Security question added successfully");
		
		return c.json({ 
			success: true,
			question: newQuestion,
		});
	} catch (error) {
		console.error("❌ Add security question error:", error);
		if (error instanceof z.ZodError) {
			return c.json({ error: "Invalid question data", details: error.issues }, 400);
		}
		return c.json({ error: "Failed to add security question" }, 500);
	}
});

// POST /api/settings/security-questions/verify - Verify a security question answer
app.post("/security-questions/verify", async (c) => {
	try {
		const userId = (c as any).get("userId") as string;
		const body = await c.req.json();
		
		console.log("🔐 Verifying security answer for user:", userId);
		
		const validated = verifySecurityAnswerSchema.parse(body);
		
		// Get the question
		const [question] = await db
			.select()
			.from(securityQuestion)
			.where(
				and(
					eq(securityQuestion.id, validated.questionId),
					eq(securityQuestion.userId, userId)
				)
			)
			.limit(1);
		
		if (!question) {
			return c.json({ error: "Security question not found" }, 404);
		}
		
		// Verify the answer
		const isCorrect = await verifyAnswer(question.answerHash, validated.answer);
		
		console.log("✅ Security answer verification:", isCorrect ? "correct" : "incorrect");
		
		return c.json({ 
			verified: isCorrect,
		});
	} catch (error) {
		console.error("❌ Verify security answer error:", error);
		if (error instanceof z.ZodError) {
			return c.json({ error: "Invalid verification data", details: error.issues }, 400);
		}
		return c.json({ error: "Failed to verify answer" }, 500);
	}
});

// DELETE /api/settings/security-questions/:id - Delete a security question
app.delete("/security-questions/:id", async (c) => {
	try {
		const userId = (c as any).get("userId") as string;
		const questionId = c.req.param("id");
		
		console.log("🔐 Deleting security question:", questionId, "for user:", userId);
		
		// Delete the question (only if it belongs to the user)
		const result = await db
			.delete(securityQuestion)
			.where(
				and(
					eq(securityQuestion.id, questionId),
					eq(securityQuestion.userId, userId)
				)
			)
			.returning();
		
		if (result.length === 0) {
			return c.json({ error: "Security question not found" }, 404);
		}
		
		console.log("✅ Security question deleted successfully");
		
		return c.json({ 
			success: true,
		});
	} catch (error) {
		console.error("❌ Delete security question error:", error);
		return c.json({ error: "Failed to delete security question" }, 500);
	}
});

// Password Recovery Endpoints (No authentication required)

// POST /api/settings/recovery/questions - Get security questions for password recovery
app.post("/recovery/questions", async (c) => {
	try {
		const body = await c.req.json();
		
		console.log("🔐 Getting recovery questions for email");
		
		const validated = getQuestionsForRecoverySchema.parse(body);
		
		// Find user by email from the user table
		const { user: userSchema } = await import("@krypt-vault/db");
		const [foundUser] = await db
			.select({
				id: userSchema.id,
				email: userSchema.email,
			})
			.from(userSchema)
			.where(eq(userSchema.email, validated.email))
			.limit(1);
		
		if (!foundUser) {
			// Don't reveal if email exists or not for security
			return c.json({ 
				questions: [],
				message: "If this email exists, security questions will be shown"
			});
		}
		
		// Get security questions for this user
		const questions = await db
			.select({
				id: securityQuestion.id,
				question: securityQuestion.question,
			})
			.from(securityQuestion)
			.where(eq(securityQuestion.userId, foundUser.id));
		
		if (questions.length === 0) {
			return c.json({ 
				questions: [],
				message: "No security questions set up for this account"
			});
		}
		
		console.log(`✅ Found ${questions.length} security questions`);
		
		return c.json({ 
			questions,
			userId: foundUser.id, // We'll need this for verification
		});
	} catch (error) {
		console.error("❌ Get recovery questions error:", error);
		if (error instanceof z.ZodError) {
			return c.json({ error: "Invalid email", details: error.issues }, 400);
		}
		return c.json({ error: "Failed to get recovery questions" }, 500);
	}
});

// POST /api/settings/recovery/verify - Verify security answers and generate recovery token
app.post("/recovery/verify", async (c) => {
	try {
		const body = await c.req.json();
		
		console.log("🔐 Verifying recovery answers");
		
		const validated = verifyRecoveryAnswersSchema.parse(body);
		
		// Find user by email from the user table
		const { user: userSchema } = await import("@krypt-vault/db");
		const [foundUser] = await db
			.select({
				id: userSchema.id,
				email: userSchema.email,
			})
			.from(userSchema)
			.where(eq(userSchema.email, validated.email))
			.limit(1);
		
		if (!foundUser) {
			return c.json({ error: "Invalid email or answers" }, 401);
		}
		
		// Verify all answers
		let allCorrect = true;
		for (const answer of validated.answers) {
			const [question] = await db
				.select()
				.from(securityQuestion)
				.where(
					and(
						eq(securityQuestion.id, answer.questionId),
						eq(securityQuestion.userId, foundUser.id)
					)
				)
				.limit(1);
			
			if (!question) {
				allCorrect = false;
				break;
			}
			
			const isCorrect = await verifyAnswer(question.answerHash, answer.answer);
			if (!isCorrect) {
				allCorrect = false;
				break;
			}
		}
		
		if (!allCorrect) {
			console.log("❌ Security answers verification failed");
			return c.json({ error: "Invalid answers" }, 401);
		}
		
		// Generate a temporary recovery token (valid for 15 minutes)
		const recoveryToken = randomBytes(32).toString("hex");
		const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes
		
		// Store recovery token in verification table
		await db
			.insert((await import("@krypt-vault/db")).verification)
			.values({
				id: uuidv4(),
				identifier: validated.email,
				value: recoveryToken,
				expiresAt,
				createdAt: new Date(),
			});
		
		console.log("✅ Security answers verified, recovery token generated");
		
		return c.json({ 
			verified: true,
			recoveryToken,
			expiresAt,
		});
	} catch (error) {
		console.error("❌ Verify recovery answers error:", error);
		if (error instanceof z.ZodError) {
			return c.json({ error: "Invalid verification data", details: error.issues }, 400);
		}
		return c.json({ error: "Failed to verify answers" }, 500);
	}
});

// POST /api/settings/recovery/reset-password - Reset password using recovery token
app.post("/recovery/reset-password", async (c) => {
	try {
		const body = await c.req.json();
		
		console.log("🔐 Resetting password with recovery token");
		
		const validated = resetPasswordSchema.parse(body);
		
		// Verify recovery token
		const [verification] = await db
			.select()
			.from((await import("@krypt-vault/db")).verification)
			.where(
				and(
					eq((await import("@krypt-vault/db")).verification.identifier, validated.email),
					eq((await import("@krypt-vault/db")).verification.value, validated.recoveryToken)
				)
			)
			.limit(1);
		
		if (!verification) {
			return c.json({ error: "Invalid or expired recovery token" }, 401);
		}
		
		// Check if token is expired
		if (new Date() > verification.expiresAt) {
			// Delete expired token
			await db
				.delete((await import("@krypt-vault/db")).verification)
				.where(eq((await import("@krypt-vault/db")).verification.id, verification.id));
			
			return c.json({ error: "Recovery token has expired" }, 401);
		}
		
		// Find user by email first
		const { user: userSchema, account: accountSchema } = await import("@krypt-vault/db");
		const [foundUser] = await db
			.select()
			.from(userSchema)
			.where(eq(userSchema.email, validated.email))
			.limit(1);
		
		if (!foundUser) {
			return c.json({ error: "User not found" }, 404);
		}
		
		// Find the user's account
		const [userAccount] = await db
			.select()
			.from(accountSchema)
			.where(eq(accountSchema.userId, foundUser.id))
			.limit(1);
		
		if (!userAccount) {
			return c.json({ error: "User account not found" }, 404);
		}
		
		// Import better-auth hashPassword utility
		// Better-auth stores password hash in the account table
		// We'll use scrypt to match better-auth's default hashing
		const salt = randomBytes(16);
		const hashedPasswordBuffer = (await scryptAsync(validated.newPassword, salt, 64)) as Buffer;
		const hashedPassword = `${hashedPasswordBuffer.toString('hex')}.${salt.toString('hex')}`;
		
		// Update password
		await db
			.update((await import("@krypt-vault/db")).account)
			.set({ 
				password: hashedPassword,
				updatedAt: new Date()
			})
			.where(eq((await import("@krypt-vault/db")).account.id, userAccount.id));
		
		// Delete the used recovery token
		await db
			.delete((await import("@krypt-vault/db")).verification)
			.where(eq((await import("@krypt-vault/db")).verification.id, verification.id));
		
		console.log("✅ Password reset successfully");
		
		return c.json({ 
			success: true,
			message: "Password has been reset successfully",
		});
	} catch (error) {
		console.error("❌ Reset password error:", error);
		if (error instanceof z.ZodError) {
			return c.json({ error: "Invalid reset data", details: error.issues }, 400);
		}
		return c.json({ error: "Failed to reset password" }, 500);
	}
});

// DELETE /api/settings/account - Delete user account and all associated data
app.delete("/account", async (c) => {
	try {
		const userId = (c as any).get("userId") as string;
		
		console.log("🗑️ Deleting account for user:", userId);
		
		// Import necessary schemas
		const { 
			user: userSchema, 
			file: fileSchema, 
			folder: folderSchema,
			userKeypair: userKeypairSchema,
			session: sessionSchema,
			account: accountSchema,
			verification: verificationSchema,
			fileKey: fileKeySchema,
			folderKey: folderKeySchema,
			fileFolderKey: fileFolderKeySchema,
		} = await import("@krypt-vault/db");
		
		const { DeleteObjectCommand } = await import("@aws-sdk/client-s3");
		const { s3Client } = await import("../lib/s3");
		
		// 1. Get all files owned by the user (to delete from S3)
		const userFiles = await db
			.select()
			.from(fileSchema)
			.where(eq(fileSchema.userId, userId));
		
		console.log(`📁 Found ${userFiles.length} files to delete from S3`);
		
		// 2. Delete all files from S3
		for (const file of userFiles) {
			try {
				await s3Client.send(new DeleteObjectCommand({
					Bucket: file.s3Bucket,
					Key: file.s3Key,
				}));
				console.log(`✅ Deleted S3 object: ${file.s3Key}`);
			} catch (error) {
				console.error(`❌ Failed to delete S3 object ${file.s3Key}:`, error);
				// Continue with deletion even if S3 deletion fails
			}
		}
		
		// 3. Delete all file-folder associations (must be before files)
		await db
			.delete(fileFolderKeySchema)
			.where(
				sql`file_id IN (SELECT id FROM ${fileSchema} WHERE user_id = ${userId})`
			);
		console.log("✅ Deleted file-folder associations");
		
		// 4. Delete all file keys (shared access records) - both given and received
		await db.delete(fileKeySchema).where(eq(fileKeySchema.recipientUserId, userId));
		await db.delete(fileKeySchema).where(
			sql`file_id IN (SELECT id FROM ${fileSchema} WHERE user_id = ${userId})`
		);
		console.log("✅ Deleted file keys");
		
		// 5. Delete all files owned by user
		await db.delete(fileSchema).where(eq(fileSchema.userId, userId));
		console.log("✅ Deleted files");
		
		// 6. Delete all folder keys - both given and received
		await db.delete(folderKeySchema).where(eq(folderKeySchema.recipientUserId, userId));
		await db.delete(folderKeySchema).where(
			sql`folder_id IN (SELECT id FROM ${folderSchema} WHERE owner_id = ${userId})`
		);
		console.log("✅ Deleted folder keys");
		
		// 7. Delete all folders owned by user
		await db.delete(folderSchema).where(eq(folderSchema.ownerId, userId));
		console.log("✅ Deleted folders");
		
		// 8. Delete user settings
		await db.delete(userSettings).where(eq(userSettings.userId, userId));
		console.log("✅ Deleted user settings");
		
		// 9. Delete security questions
		await db.delete(securityQuestion).where(eq(securityQuestion.userId, userId));
		console.log("✅ Deleted security questions");
		
		// 10. Delete user keypair
		await db.delete(userKeypairSchema).where(eq(userKeypairSchema.userId, userId));
		console.log("✅ Deleted user keypair");
		
		// 11. Delete all verification tokens for this user
		const [user] = await db
			.select({ email: userSchema.email })
			.from(userSchema)
			.where(eq(userSchema.id, userId))
			.limit(1);
		
		if (user?.email) {
			await db.delete(verificationSchema).where(eq(verificationSchema.identifier, user.email));
			console.log("✅ Deleted verification tokens");
		}
		
		// 12. Delete all sessions
		await db.delete(sessionSchema).where(eq(sessionSchema.userId, userId));
		console.log("✅ Deleted sessions");
		
		// 13. Delete account record (contains password hash)
		await db.delete(accountSchema).where(eq(accountSchema.userId, userId));
		console.log("✅ Deleted account");
		
		// 14. Finally, delete the user record (this will cascade to any remaining references)
		await db.delete(userSchema).where(eq(userSchema.id, userId));
		console.log("✅ Deleted user record");
		
		console.log("🎉 Account deletion completed successfully");
		
		return c.json({ 
			success: true,
			message: "Account deleted successfully",
			deletedFiles: userFiles.length,
		});
	} catch (error) {
		console.error("❌ Delete account error:", error);
		return c.json({ 
			error: "Failed to delete account",
			details: error instanceof Error ? error.message : String(error)
		}, 500);
	}
});

export default app;
