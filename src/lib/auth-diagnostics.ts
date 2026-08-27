import "server-only";

/**
 * Authentication diagnostics are intentionally opt-in and server-only. They
 * help local development without turning the public login response into an
 * account-enumeration endpoint.
 */
export function isDevelopmentAuthDiagnosticsEnabled() {
  return process.env.NODE_ENV === "development" && process.env.BINNIE_AUTH_DIAGNOSTICS === "true";
}

export function authDiagnostic(event: string, details?: Record<string, unknown>) {
  if (!isDevelopmentAuthDiagnosticsEnabled()) return;
  console.info(`[Binnie auth] ${event}`, details || {});
}
