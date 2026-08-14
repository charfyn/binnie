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

  if (isSupabasePooler && sslMode === "require") {
    url.searchParams.delete("sslmode");
    const pool = new Pool({ connectionString: url.toString(), ssl: { rejectUnauthorized: false } });
    return new PrismaPg(pool, { schema, disposeExternalPool: true });
  }

  return new PrismaPg({ connectionString }, { schema });
}
