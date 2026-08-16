import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

/**
 * Creates the Postgres driver adapter used by both the app and operational
 * scripts. Supabase poolers can present a tenant certificate chain that `pg`
 * cannot validate with its bundled roots even when the connection is required
 * to be encrypted. Keep that exception tightly scoped to Supabase hosts.
 */
export function createPostgresAdapter(connectionString: string) {
  const url = new URL(connectionString);
  const schema = url.searchParams.get("schema") || undefined;
  const isSupabasePooler = url.hostname.endsWith(".supabase.com");
  const sslMode = url.searchParams.get("sslmode");

  // A workspace snapshot intentionally loads several related records. Keep a
  // small shared client pool so concurrent development renders cannot exhaust
  // a transaction-pooler's session limit before those reads complete.
  const max = 4;

  if (isSupabasePooler && sslMode === "require") {
    url.searchParams.delete("sslmode");
    const pool = new Pool({ connectionString: url.toString(), max, ssl: { rejectUnauthorized: false } });
    return new PrismaPg(pool, { schema, disposeExternalPool: true });
  }

  const pool = new Pool({ connectionString, max });
  return new PrismaPg(pool, { schema, disposeExternalPool: true });
}
