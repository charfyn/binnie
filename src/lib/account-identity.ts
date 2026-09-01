import { randomBytes } from "node:crypto";

export const USERNAME_PATTERN = /^[a-z0-9_.]+$/;
export const MIN_USERNAME_LENGTH = 3;
export const MAX_USERNAME_LENGTH = 30;
export const TEMPORARY_PASSWORD_TTL_MS = 7 * 24 * 60 * 60 * 1000;

/** Usernames are credentials, not domain identity. Keep the normalization in
 * one place so lookup, unique enforcement, and account-management UI agree. */
export function normalizeUsername(value: string) {
  return value.trim().toLowerCase();
}

export function validateUsername(value: string) {
  const normalized = normalizeUsername(value);
  if (normalized.length < MIN_USERNAME_LENGTH || normalized.length > MAX_USERNAME_LENGTH || !USERNAME_PATTERN.test(normalized)) return null;
  return normalized;
}

/** Better Auth's core User schema requires an email column. New Binnie
 * credential accounts get a non-routable technical identifier; it is never a
 * login name, a Person contact field, or an email-delivery destination. */
export function internalAuthIdentityEmail(authUserId: string) {
  return `auth-${authUserId}@accounts.binnie.invalid`;
}

/** A printable, cryptographically random bootstrap/reset secret. Its hash
 * alone is persisted through Better Auth; callers must show it once only. */
export function generateTemporaryPassword() {
  return randomBytes(24).toString("base64url");
}
