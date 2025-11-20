import { betterAuth, type BetterAuthOptions } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { db } from "@krypt-vault/db";
import * as schema from "@krypt-vault/db/schema/auth";
import { bearer } from "better-auth/plugins/bearer";
import { passkey } from "better-auth/plugins/passkey";

const normalizeOrigin = (origin: string) => origin.replace(/\/$/, "");

const resolvedPasskeyOrigin = normalizeOrigin(
  process.env.PASSKEY_ORIGIN || process.env.CORS_ORIGIN || "http://localhost:3001",
);

const resolveRpId = () => {
  if (process.env.PASSKEY_RP_ID) {
    return process.env.PASSKEY_RP_ID;
  }

  try {
    return new URL(resolvedPasskeyOrigin).hostname;
  } catch {
    return "localhost";
  }
};

const passkeyPlugin = passkey({
  rpID: resolveRpId(),
  rpName: process.env.PASSKEY_RP_NAME || "KryptVault",
  origin: resolvedPasskeyOrigin,
});

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
    process.env.PASSKEY_ORIGIN,
    resolvedPasskeyOrigin,
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
  plugins: [bearer(), passkeyPlugin],
});
