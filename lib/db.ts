import { neon, neonConfig } from "@neondatabase/serverless";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL environment variable is not set");
}

// Enable WebSockets for improved performance (optional)
neonConfig.webSocketConstructor =
  typeof WebSocket !== "undefined" ? WebSocket : undefined;

// Create global client to avoid multiple instances in dev
const globalForNeon = globalThis as unknown as {
  sql?: ReturnType<typeof neon>;
};

export const sql = globalForNeon.sql || neon(process.env.DATABASE_URL!);

// Avoid recreating the connection on hot reload (dev only)
if (process.env.NODE_ENV !== "production") globalForNeon.sql = sql;
