import { betterAuth, type BetterAuthOptions } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { db } from "@krypt-vault/db";
import * as schema from "@krypt-vault/db/schema/auth";
import { bearer } from "better-auth/plugins/bearer";

export const auth = betterAuth<BetterAuthOptions>({
  database: drizzleAdapter(db, {
    provider: "pg",

    schema: schema,
  }),
  trustedOrigins: [
    "tauri://localhost",
    "http://localhost:3001",
    "http://127.0.0.1:3001",
    process.env.CORS_ORIGIN,
  ].filter(Boolean) as string[],
  emailAndPassword: {
    enabled: true,
  },
  advanced: {
    defaultCookieAttributes: {
      sameSite: "lax",
      secure: false,
      httpOnly: true,
    },
  },
  plugins: [bearer()],
});
