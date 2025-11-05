import type { auth } from "@krypt-vault/auth";
import { inferAdditionalFields, lastLoginMethodClient, passkeyClient, twoFactorClient } from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";

export const authClient = createAuthClient({
	baseURL: process.env.NEXT_PUBLIC_SERVER_URL,
	plugins: [
	  inferAdditionalFields<typeof auth>(),
		lastLoginMethodClient(),
		passkeyClient	(),
		twoFactorClient(),
	],
});
