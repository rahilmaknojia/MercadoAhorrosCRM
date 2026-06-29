import { createAuthClient } from "better-auth/react";

/**
 * Browser-side Better Auth client. Used only to *start* sign-in (Microsoft redirect for
 * staff, email+password for the Owner local account) and to sign out. All data access goes
 * through this app's server (the BFF), never the auth service directly.
 */
export const authClient = createAuthClient({
  baseURL: process.env.NEXT_PUBLIC_AUTH_SERVICE_URL!,
  basePath: process.env.NEXT_PUBLIC_AUTH_BASE_PATH || "/api/auth",
});
