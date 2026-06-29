import "server-only";

const AUTH = process.env.NEXT_PUBLIC_AUTH_SERVICE_URL!;
const BASE = process.env.NEXT_PUBLIC_AUTH_BASE_PATH || "/api/auth";

export type SessionUser = {
  id: string;
  email: string;
  name?: string | null;
  role?: string | null;
  image?: string | null;
};

/** Validate the Better Auth session by forwarding the browser's cookies to the auth service. */
export async function getSession(cookie: string | null): Promise<SessionUser | null> {
  if (!cookie) return null;
  const res = await fetch(`${AUTH}/api/session`, {
    headers: { cookie },
    cache: "no-store",
  });
  if (!res.ok) return null;
  const body = (await res.json().catch(() => null)) as { user?: SessionUser } | null;
  return body?.user ?? null;
}

/** Mint a short-lived ES256 JWT for the current session (server-side only; never sent to the browser). */
export async function getJwt(cookie: string | null): Promise<string | null> {
  if (!cookie) return null;
  const res = await fetch(`${AUTH}${BASE}/token`, {
    headers: { cookie },
    cache: "no-store",
  });
  if (!res.ok) return null;
  const body = (await res.json().catch(() => null)) as { token?: string } | null;
  return body?.token ?? null;
}
