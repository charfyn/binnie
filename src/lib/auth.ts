import "server-only";

import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { getDb } from "@/lib/db";
import { usernamePasswordPlugin } from "@/lib/username-password-auth";

export function binnieBaseUrl() {
  const configured = process.env.BETTER_AUTH_URL || process.env.NEXTAUTH_URL;
  if (configured) return configured.replace(/\/$/, "");
  if (process.env.NODE_ENV === "production") throw new Error("BETTER_AUTH_URL is required in production.");
  return "http://localhost:3000";
}

function authSecret() {
  const configured = process.env.BETTER_AUTH_SECRET || process.env.NEXTAUTH_SECRET;
  if (configured) return configured;
  if (process.env.NODE_ENV === "production") throw new Error("BETTER_AUTH_SECRET is required in production.");
  return "binnie-development-auth-secret-change-before-production";
}

/** Better Auth owns credential hashing, signed HttpOnly sessions, and session
 * revocation. Binnie owns Person-to-account linkage and authorization. */
export const auth = betterAuth({
  baseURL: binnieBaseUrl(),
  secret: authSecret(),
  trustedOrigins: [new URL(binnieBaseUrl()).origin],
  database: prismaAdapter(getDb(), { provider: "postgresql", transaction: true }),
  user: { modelName: "authUser" },
  session: { modelName: "authSession", expiresIn: 60 * 60 * 24 * 30, updateAge: 60 * 60 * 24 },
  account: { modelName: "authAccount" },
  verification: { modelName: "authVerification" },
  // Core credentials provide Better Auth's tested hash/verify primitives.
  // The public email endpoints are blocked in the route handler; Binnie
  // exposes only its username endpoint and never requires an employee email.
  emailAndPassword: { enabled: true, minPasswordLength: 8, maxPasswordLength: 128 },
  rateLimit: { enabled: true, storage: "database", modelName: "authRateLimit", window: 60, max: 20 },
  plugins: [usernamePasswordPlugin()],
});
