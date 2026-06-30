import Link from "next/link";
import { headers } from "next/headers";
import { getSession } from "@/lib/server/auth";
import { apiFetch } from "@/lib/server/api";
import { TerritoryForm } from "@/components/territory-form";

const PRIVILEGED = new Set(["owner", "admin"]);
function isPrivileged(role: string | null | undefined): boolean {
  return (role ?? "").split(",").some((r) => PRIVILEGED.has(r.trim().toLowerCase()));
}

async function fetchJson<T>(path: string, fallback: T): Promise<T> {
  try {
    const res = await apiFetch(path);
    if (!res.ok) return fallback;
    return (await res.json()) as T;
  } catch {
    return fallback;
  }
}

export default async function TerritoryPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ email?: string }>;
}) {
  const { id } = await params;
  const { email } = await searchParams;

  const viewer = await getSession((await headers()).get("cookie"));
  if (!isPrivileged(viewer?.role)) {
    return (
      <div className="rounded-md border border-destructive/40 bg-destructive/5 p-6 text-sm text-destructive">
        You don&apos;t have permission to manage territory access.
      </div>
    );
  }

  const [available, grants] = await Promise.all([
    fetchJson<string[]>("/api/userstategrants/available", []),
    fetchJson<{ states?: string[] }>(`/api/userstategrants/${encodeURIComponent(id)}`, {}),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <Link href="/settings/users" className="text-sm text-muted-foreground hover:underline">
          ← Back to users
        </Link>
        <h2 className="mt-1 text-lg font-semibold">Territory access</h2>
        <p className="text-sm text-muted-foreground">
          Choose which states {email ? <span className="font-medium">{email}</span> : "this user"} can
          see. Owners and Admins always see every state. A user with no states selected sees no
          customers.
        </p>
      </div>
      <TerritoryForm userId={id} available={available} current={grants.states ?? []} />
    </div>
  );
}
