import "server-only";
import { headers } from "next/headers";
import { getSession } from "@/lib/server/auth";

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
