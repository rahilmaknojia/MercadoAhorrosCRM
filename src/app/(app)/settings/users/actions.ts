"use server";

import { revalidatePath } from "next/cache";
import { authApiFetch } from "@/lib/server/auth-api";
import { APP_ROLES } from "@/lib/types";

export type ActionResult = { ok: boolean; error?: string };
export type InviteState = { error?: string; success?: string };

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const USERS_PATH = "/settings/users";

// The auth service returns a structured error message for owner-protection / last-owner
// violations; surface it directly so the operator understands why an action was blocked.
async function errorMessage(res: Response, fallback: string): Promise<string> {
  const body = (await res.json().catch(() => null)) as { message?: string } | null;
  return body?.message || fallback;
}

export async function setUserRole(userId: string, role: string): Promise<ActionResult> {
  if (!userId) return { ok: false, error: "Missing user." };
  if (!APP_ROLES.includes(role as (typeof APP_ROLES)[number])) {
    return { ok: false, error: "Unknown role." };
  }

  const res = await authApiFetch("/api/auth/admin/set-role", {
    method: "POST",
    body: JSON.stringify({ userId, role }),
  }).catch(() => null);

  if (!res) return { ok: false, error: "Could not reach the auth service." };
  if (!res.ok) return { ok: false, error: await errorMessage(res, `Failed to set role (${res.status}).`) };

  revalidatePath(USERS_PATH);
  return { ok: true };
}

export async function setUserBanned(userId: string, banned: boolean): Promise<ActionResult> {
  if (!userId) return { ok: false, error: "Missing user." };

  const path = banned ? "/api/auth/admin/ban-user" : "/api/auth/admin/unban-user";
  const res = await authApiFetch(path, {
    method: "POST",
    body: JSON.stringify({ userId }),
  }).catch(() => null);

  if (!res) return { ok: false, error: "Could not reach the auth service." };
  if (!res.ok) {
    return {
      ok: false,
      error: await errorMessage(res, `Failed to ${banned ? "ban" : "reactivate"} user (${res.status}).`),
    };
  }

  revalidatePath(USERS_PATH);
  return { ok: true };
}

export async function inviteEmail(_prev: InviteState, formData: FormData): Promise<InviteState> {
  const email = String(formData.get("email") ?? "").toLowerCase().trim();
  if (!email || !EMAIL_RE.test(email)) {
    return { error: "Enter a valid email address." };
  }

  const res = await authApiFetch("/api/invitations", {
    method: "POST",
    body: JSON.stringify({ email }),
  }).catch(() => null);

  if (!res) return { error: "Could not reach the auth service. Try again." };
  if (res.status === 403) return { error: "You don't have permission to invite users." };
  if (res.status === 401) return { error: "Your session has expired. Please sign in again." };
  if (!res.ok) return { error: `Failed to invite (${res.status}).` };

  revalidatePath(USERS_PATH);
  return { success: `Invited ${email}.` };
}

export async function revokeInvitation(formData: FormData): Promise<void> {
  const email = String(formData.get("email") ?? "").toLowerCase().trim();
  if (!email) return;
  await authApiFetch(`/api/invitations/${encodeURIComponent(email)}`, {
    method: "DELETE",
  }).catch(() => null);
  revalidatePath(USERS_PATH);
}
