import type { auth } from "@krypt-vault/auth";
import { inferAdditionalFields, lastLoginMethodClient, passkeyClient, twoFactorClient } from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";

export const authClient = createAuthClient({
	baseURL: process.env.NEXT_PUBLIC_SERVER_URL,
	plugins: [
	  inferAdditionalFields<typeof auth>(),
		lastLoginMethodClient(),
		passkeyClient(),
		twoFactorClient(),
	],
	fetchOptions: {
		onSuccess: (ctx) => {
			if (typeof window === "undefined") return;
			
			const authToken = ctx.response.headers.get("set-auth-token");
			// Store the token securely in localStorage
			if (authToken) {
				localStorage.setItem("bearer_token", authToken);
			}
		},
		onError: (ctx) => {
			if (typeof window === "undefined") return;
			
			// Clear the token on authentication errors (401)
			if (ctx.response.status === 401) {
				localStorage.removeItem("bearer_token");
			}
		},
		auth: {
			type: "Bearer",
			token: () => {
				if (typeof window === "undefined") return "";
				return localStorage.getItem("bearer_token") || "";
			}
		}
	},
});
