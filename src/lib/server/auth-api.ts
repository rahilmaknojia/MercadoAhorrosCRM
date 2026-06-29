import "server-only";
import { cache } from "react";
import { headers } from "next/headers";

const AUTH = process.env.NEXT_PUBLIC_AUTH_SERVICE_URL!;

// Memoized per request: read the incoming browser cookies once.
const incomingCookie = cache(async () => (await headers()).get("cookie"));

/**
 * BFF fetch against the auth service using the browser's session cookie. Used for
 * session-gated auth-service endpoints (e.g. the invitation allowlist), which are
 * authorized by the Better Auth session rather than the API's JWT. The cookie never
 * leaves the server boundary beyond the auth service it was issued for.
 */
export async function authApiFetch(path: string, init?: RequestInit): Promise<Response> {
  const cookie = await incomingCookie();
  const requestHeaders: Record<string, string> = {
    ...(init?.headers as Record<string, string> | undefined),
  };
  if (cookie) requestHeaders["cookie"] = cookie;
  if (init?.body && !requestHeaders["Content-Type"]) {
    requestHeaders["Content-Type"] = "application/json";
  }
  return fetch(`${AUTH}${path}`, { ...init, headers: requestHeaders, cache: "no-store" });
}
