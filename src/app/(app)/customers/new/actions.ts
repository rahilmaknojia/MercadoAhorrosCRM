"use server";

import { redirect } from "next/navigation";
import { apiFetch } from "@/lib/server/api";

export type CreateState = { error?: string };

export async function createCustomer(
  _prev: CreateState,
  formData: FormData
): Promise<CreateState> {
  const str = (key: string) => {
    const value = formData.get(key);
    const trimmed = value ? String(value).trim() : "";
    return trimmed.length ? trimmed : undefined;
  };

  const contactName = str("contactName");
  if (!contactName) {
    return { error: "Contact name is required." };
  }

  const body = {
    contactName,
    businessName: str("businessName"),
    corpName: str("corpName"),
    email: str("email"),
    storePhone: str("storePhone"),
    storeAddress: str("storeAddress"),
    storeCity: str("storeCity"),
    storeState: str("storeState"),
    storeZipcode: str("storeZipcode"),
    status: str("status") ?? "Pending",
  };

  const res = await apiFetch("/api/customers", {
    method: "POST",
    body: JSON.stringify(body),
  }).catch(() => null);

  if (!res) return { error: "Your session has expired. Please sign in again." };
  if (res.status === 403) return { error: "You don't have permission to create customers." };
  if (!res.ok) return { error: `Failed to create customer (${res.status}).` };

  redirect("/customers");
}
