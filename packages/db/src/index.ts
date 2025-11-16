import { drizzle } from "drizzle-orm/node-postgres";

export const db = drizzle(process.env.DATABASE_URL || "");

export * from "./schema/auth";
export * from "./schema/files";
export * from "drizzle-orm";