import type { auth } from "@krypt-vault/auth";
import { createAuthClient } from "better-auth/react";
import { inferAdditionalFields } from "better-auth/client/plugins";

const baseURL = import.meta.env.VITE_SERVER_URL || "http://localhost:3000";

console.log("Auth Client Configuration:", {
  baseURL,
  env: import.meta.env.VITE_SERVER_URL,
  mode: import.meta.env.MODE,
});

export const authClient = createAuthClient({
  baseURL,
  plugins: [inferAdditionalFields<typeof auth>()],
  fetchOptions: {
    onSuccess: (ctx) => {
      if (typeof window === "undefined") return;

      const authToken = ctx.response.headers.get("set-auth-token");
      // Store the token securely in localStorage
      if (authToken) {
        console.log("✅ Auth token received and stored");
        localStorage.setItem("bearer_token", authToken);
      }
    },
    onError: (ctx) => {
      if (typeof window === "undefined") return;

      console.error("❌ Auth error:", {
        status: ctx.response.status,
        statusText: ctx.response.statusText,
        url: ctx.response.url,
      });

      // Log response body for debugging
      ctx.response.clone().text().then((text) => {
        console.error("❌ Response body:", text);
      }).catch(() => {});

      // Clear the token on authentication errors (401)
      if (ctx.response.status === 401) {
        localStorage.removeItem("bearer_token");
      }
    },
    onRequest: (ctx) => {
      console.log("🔄 Auth request:", {
        url: ctx.url,
        method: ctx.method,
        headers: Object.fromEntries(ctx.headers.entries()),
      });
    },
    auth: {
      type: "Bearer",
      token: () => {
        if (typeof window === "undefined") return "";
        return localStorage.getItem("bearer_token") || "";
      },
    },
    credentials: "include",
  },
});
