"use server";

import { revalidatePath } from "next/cache";
import { authApiFetch } from "@/lib/server/auth-api";

export type InviteState = { error?: string; success?: string };

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function inviteEmail(
  _prev: InviteState,
  formData: FormData
): Promise<InviteState> {
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

  revalidatePath("/invitations");
  return { success: `Invited ${email}.` };
}

export async function revokeInvitation(formData: FormData): Promise<void> {
  const email = String(formData.get("email") ?? "").toLowerCase().trim();
  if (!email) return;
  await authApiFetch(`/api/invitations/${encodeURIComponent(email)}`, {
    method: "DELETE",
  }).catch(() => null);
  revalidatePath("/invitations");
}
