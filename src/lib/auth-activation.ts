import "server-only";

/**
 * Production access stays intentionally closed until the Owner bootstrap and
 * security gate are verified. Development is enabled by default so the full
 * invitation flow can be exercised without weakening production rollout.
 */
export function isMultiUserAuthEnabled() {
  return process.env.NODE_ENV !== "production" || process.env.BINNIE_MULTI_USER_AUTH_ENABLED === "true";
}
