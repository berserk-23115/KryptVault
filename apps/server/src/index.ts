import "dotenv/config";
import { auth } from "@krypt-vault/auth";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import filesRouter from "./routes/files";
import usersRouter from "./routes/users";
import sharingRouter from "./routes/sharing";
import foldersRouter from "./routes/folders";

const app = new Hono({ strict: false }); // Disable strict mode to handle trailing slashes

app.use(logger());
app.use(
	"/*",
	cors({
		origin: (origin) => {
			// Allow requests from Tauri apps (tauri://localhost), local development, and configured origins
			const allowedOrigins = [
				"tauri://localhost",
				"http://localhost:3001",
				"http://127.0.0.1:3001",
				process.env.CORS_ORIGIN,
			].filter(Boolean);
			
			if (!origin || allowedOrigins.includes(origin)) {
				return origin || "*";
			}
			
			return allowedOrigins[0];
		},
		allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
		allowHeaders: ["Content-Type", "Authorization", "x-user-id"],
		credentials: true,
	}),
);

app.on(["POST", "GET"], "/api/auth/*", (c) => auth.handler(c.req.raw));

app.route("/api/files", filesRouter);
app.route("/api/users", usersRouter);
app.route("/api/sharing", sharingRouter);
app.route("/api/folders", foldersRouter);

app.get("/", (c) => {
	return c.text("OK");
});

import { serve } from "@hono/node-server";

serve(
	{
		fetch: app.fetch,
		port: 3000,
	},
	(info) => {
		console.log(`Server is running on http://localhost:${info.port}`);
	},
);
