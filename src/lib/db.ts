import "server-only";

import { PrismaClient } from "@/generated/prisma/client";
import { createPostgresAdapter } from "@/lib/database-adapter";

declare global {
  var binniePrisma: PrismaClient | undefined;
}

function createClient() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) return undefined;
  return new PrismaClient({ adapter: createPostgresAdapter(connectionString) });
}

export function getDb() {
  const db = globalThis.binniePrisma ?? createClient();
  if (!db) throw new Error("BINNIE_DATABASE_NOT_CONFIGURED");
  if (process.env.NODE_ENV !== "production") globalThis.binniePrisma = db;
  return db;
}

export function hasDatabaseConfiguration() {
  return Boolean(process.env.DATABASE_URL);
}
