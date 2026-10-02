import "server-only";
import { cache } from "react";
import { headers } from "next/headers";

const AUTH = process.env.NEXT_PUBLIC_AUTH_SERVICE_URL!;

// Memoized per request: read the incoming browser cookies once.
const incomingCookie = cache(async () => (await headers()).get("cookie"));

/**
 * The origin to present to the auth service. Better Auth refuses state-changing requests that
 * carry a session cookie but no Origin ("Missing or null Origin"), as CSRF protection, and a
 * server-side fetch sends none. Pass on the browser's own Origin (a server action's POST has
 * one), else the CRM's public URL; the auth service still checks it against its trusted origins.
 */
const requestOrigin = cache(async (): Promise<string | null> => {
  const fromBrowser = (await headers()).get("origin");
  if (fromBrowser && fromBrowser !== "null") return fromBrowser;
  try {
    return process.env.NEXT_PUBLIC_CRM_URL ? new URL(process.env.NEXT_PUBLIC_CRM_URL).origin : null;
  } catch {
    return null;
  }
});

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
  const origin = await requestOrigin();
  if (origin && !requestHeaders["origin"] && !requestHeaders["Origin"]) {
    requestHeaders["origin"] = origin;
  }
  if (init?.body && !requestHeaders["Content-Type"]) {
    requestHeaders["Content-Type"] = "application/json";
  }
  return fetch(`${AUTH}${path}`, { ...init, headers: requestHeaders, cache: "no-store" });
}
