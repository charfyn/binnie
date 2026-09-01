import "server-only";

import { createHash } from "node:crypto";
import { APIError, createAuthEndpoint, formCsrfMiddleware, getIP } from "better-auth/api";
import { setSessionCookie } from "better-auth/cookies";
import { MembershipStatus, PrincipalStatus, UserAccountStatus } from "@/generated/prisma/client";
import { normalizeUsername, validateUsername } from "@/lib/account-identity";
import { authDiagnostic } from "@/lib/auth-diagnostics";
import { getDb } from "@/lib/db";
import { z } from "zod";

const LOGIN_WINDOW_MS = 10 * 60 * 1000;
const LOGIN_MAX_FAILURES = 5;
const LOGIN_BLOCK_MS = 5 * 60 * 1000;

function genericCredentialError() {
  return APIError.from("UNAUTHORIZED", { code: "INVALID_USERNAME_OR_PASSWORD", message: "Incorrect username or password." });
}

function ipHash(ip: string) {
  return createHash("sha256").update(ip).digest("base64url");
}

async function isTemporarilyBlocked(usernameNormalized: string, ip: string) {
  const db = getDb();
  const entry = await db.credentialLoginThrottle.findUnique({
    where: { usernameNormalized_ipAddressHash: { usernameNormalized, ipAddressHash: ipHash(ip) } },
  });
  if (!entry) return false;
  const now = new Date();
  if (entry.blockedUntil && entry.blockedUntil > now) return true;
  if (entry.windowStartedAt.getTime() + LOGIN_WINDOW_MS <= now.getTime()) {
    await db.credentialLoginThrottle.update({ where: { id: entry.id }, data: { failureCount: 0, blockedUntil: null, windowStartedAt: now } });
  }
  return false;
}

async function recordFailure(usernameNormalized: string, ip: string) {
  const db = getDb();
  const ipAddressHash = ipHash(ip);
  const now = new Date();
  const current = await db.credentialLoginThrottle.findUnique({ where: { usernameNormalized_ipAddressHash: { usernameNormalized, ipAddressHash } } });
  if (!current) {
    await db.credentialLoginThrottle.create({ data: { usernameNormalized, ipAddressHash, failureCount: 1, windowStartedAt: now } }).catch(() => undefined);
    return;
  }
  const insideWindow = current.windowStartedAt.getTime() + LOGIN_WINDOW_MS > now.getTime();
  const failureCount = insideWindow ? current.failureCount + 1 : 1;
  await db.credentialLoginThrottle.update({
    where: { id: current.id },
    data: {
      failureCount,
      windowStartedAt: insideWindow ? current.windowStartedAt : now,
      blockedUntil: failureCount >= LOGIN_MAX_FAILURES ? new Date(now.getTime() + LOGIN_BLOCK_MS) : null,
    },
  });
}

async function clearFailures(usernameNormalized: string, ip: string) {
  await getDb().credentialLoginThrottle.deleteMany({ where: { usernameNormalized, ipAddressHash: ipHash(ip) } });
}

/**
 * Binnie's credential endpoint intentionally keeps username canonical on
 * UserAccount. It uses Better Auth's built-in password verifier, session
 * adapter, CSRF middleware, and signed HttpOnly session cookie; it does not
 * manufacture an application cookie or client-side login state.
 */
export function usernamePasswordPlugin() {
  return {
    id: "binnie-username-password",
    version: "1.0.0",
    rateLimit: [{
      pathMatcher: (path: string) => path === "/sign-in/username",
      window: 60,
      max: 5,
    }],
    endpoints: {
      signInUsername: createAuthEndpoint("/sign-in/username", {
        method: "POST",
        requireHeaders: true,
        use: [formCsrfMiddleware],
        body: z.object({
          username: z.string().max(120),
          password: z.string().min(1).max(128),
          rememberMe: z.boolean().optional(),
        }),
      }, async (ctx) => {
        const usernameNormalized = normalizeUsername(ctx.body.username);
        const validatedUsername = validateUsername(ctx.body.username);
        // Better Auth uses its configured client IP handling. Do not trust a
        // browser supplied identity field as a replacement for this signal.
        const ip = getIP(ctx.request || new Headers(), ctx.context.options) || "unresolved";
        if (!validatedUsername || await isTemporarilyBlocked(usernameNormalized || "invalid", ip)) {
          // Equalize the missing-user/invalid-user timing path without ever
          // storing the supplied password or exposing account existence.
          await ctx.context.password.hash(ctx.body.password);
          throw genericCredentialError();
        }

        const account = await getDb().userAccount.findFirst({
          where: {
            usernameNormalized: validatedUsername,
            status: UserAccountStatus.ACTIVE,
            person: {
              status: PrincipalStatus.ACTIVE,
              active: true,
              organizationMemberships: { some: { status: MembershipStatus.ACTIVE, accessLevel: { not: null } } },
            },
          },
          include: { authUser: true },
        });
        if (!account || (account.requiresPasswordChange && account.temporaryPasswordExpiresAt && account.temporaryPasswordExpiresAt <= new Date())) {
          await ctx.context.password.hash(ctx.body.password);
          await recordFailure(validatedUsername, ip);
          throw genericCredentialError();
        }

        const credential = await ctx.context.internalAdapter.findCredentialAccount(account.authUserId);
        if (!credential?.password || !await ctx.context.password.verify({ hash: credential.password, password: ctx.body.password })) {
          await recordFailure(validatedUsername, ip);
          throw genericCredentialError();
        }
        await clearFailures(validatedUsername, ip);
        const session = await ctx.context.internalAdapter.createSession(account.authUserId, ctx.body.rememberMe === false);
        if (!session) throw APIError.from("INTERNAL_SERVER_ERROR", { code: "SESSION_CREATE_FAILED", message: "Unable to sign in." });
        await setSessionCookie(ctx, { session, user: account.authUser }, ctx.body.rememberMe === false);
        await getDb().userAccount.update({ where: { id: account.id }, data: { lastLoginAt: new Date() } });
        authDiagnostic("Username/password session established", { personId: account.personId, accountId: account.id, requiresPasswordChange: account.requiresPasswordChange });
        return ctx.json({ status: true, requiresPasswordChange: account.requiresPasswordChange });
      }),
    },
  };
}
