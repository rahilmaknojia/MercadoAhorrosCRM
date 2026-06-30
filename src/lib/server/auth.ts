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

// Short-lived in-memory cache of minted JWTs, keyed by the session cookie. A single
// page can fire many BFF calls at once (e.g. the photo gallery presigning N images);
// without this, each call re-mints a token against the auth service, which floods it
// and yields intermittent 401s. We also de-dupe concurrent mints for the same cookie.
const JWT_TTL_MS = 60_000;
const jwtCache = new Map<string, { token: string; exp: number }>();
const jwtInflight = new Map<string, Promise<string | null>>();

async function mintJwt(cookie: string): Promise<string | null> {
  const res = await fetch(`${AUTH}${BASE}/token`, { headers: { cookie }, cache: "no-store" });
  if (!res.ok) return null;
  const body = (await res.json().catch(() => null)) as { token?: string } | null;
  const token = body?.token ?? null;
  if (token) jwtCache.set(cookie, { token, exp: Date.now() + JWT_TTL_MS });
  return token;
}

/** Mint a short-lived ES256 JWT for the current session (server-side only; never sent to the browser). */
export async function getJwt(cookie: string | null): Promise<string | null> {
  if (!cookie) return null;

  const hit = jwtCache.get(cookie);
  if (hit && hit.exp > Date.now()) return hit.token;

  // Coalesce concurrent mints for the same cookie into one request.
  const pending = jwtInflight.get(cookie);
  if (pending) return pending;

  const p = mintJwt(cookie).finally(() => jwtInflight.delete(cookie));
  jwtInflight.set(cookie, p);
  return p;
}
