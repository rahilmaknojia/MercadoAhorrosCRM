import "server-only";
import { headers } from "next/headers";
import { getSession, getJwt } from "@/lib/server/auth";

const PRIVILEGED_ROLES = new Set(["owner", "admin"]);

function rolesOf(role?: string | null): string[] {
  return (role ?? "")
    .split(",")
    .map((r) => r.trim().toLowerCase())
    .filter(Boolean);
}

/**
 * Defense-in-depth authorization for server actions and route handlers.
 *
 * The UI's `useCan`/`RequirePrivileged` only hides controls — a server action is a POST endpoint
 * any authenticated user can invoke directly. This re-checks the session server-side so a
 * low-privilege user cannot drive a privileged action just because the button was hidden. The
 * downstream auth service / .NET API also enforce authorization; this is a second gate, not the
 * only one.
 */
export async function isPrivileged(): Promise<boolean> {
  const cookie = (await headers()).get("cookie");
  const session = await getSession(cookie);
  return rolesOf(session?.role).some((r) => PRIVILEGED_ROLES.has(r));
}

/**
 * True when the caller holds a specific permission, resolved from the API.
 *
 * `isPrivileged()` above only answers "Owner or Admin", which is too blunt for capabilities Staff
 * also hold. Route handlers are public POST/GET endpoints, so anything gated in the UI with
 * `useCan` needs a real check here too — hiding a button gates nothing.
 *
 * The API remains the authority; this is a near gate so a request that will be refused does not
 * first do the work.

/**
 * True when the caller holds a specific permission, resolved from the API.
 *
 * `isPrivileged()` above only answers "Owner or Admin", which is too blunt for capabilities Staff
 * also hold. Route handlers are public endpoints, so anything gated in the UI with `useCan` needs a
 * real check here too — hiding a button gates nothing.
 *
 * Pass `cookie` from a route handler (`req.headers.get("cookie")`). Server components and actions
 * can omit it and the ambient request headers are used, matching `apiFetch`.
 *
 * The API remains the authority; this is a near gate so a request that will be refused does not
 * first do the work.
 */
export async function hasPermission(permission: string, cookie?: string | null): Promise<boolean> {
  try {
    const incoming = cookie ?? (await headers()).get("cookie");
    const jwt = await getJwt(incoming);
    if (!jwt) return false;

    const res = await fetch(`${process.env.API_BASE_URL}/api/me/permissions`, {
      headers: { Authorization: `Bearer ${jwt}` },
      cache: "no-store",
    });
    if (!res.ok) return false;

    const permissions = (await res.json()) as string[];
    return Array.isArray(permissions) && permissions.includes(permission);
  } catch {
    return false;
  }
}
