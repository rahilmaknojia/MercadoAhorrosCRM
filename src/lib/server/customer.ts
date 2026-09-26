import "server-only";
import { cache } from "react";
import type { Metadata } from "next";
import { apiFetch } from "./api";
import type { Customer } from "@/lib/types";

/**
 * One customer fetch per request, shared by a page's generateMetadata (tab title) and the page.
 * `status` is null on a transport error, otherwise the API's HTTP status.
 */
export const loadCustomer = cache(
  async (id: string): Promise<{ status: number | null; customer: Customer | null }> => {
    try {
      const res = await apiFetch(`/api/customers/${id}`);
      if (!res.ok) return { status: res.status, customer: null };
      return { status: res.status, customer: (await res.json()) as Customer };
    } catch {
      return { status: null, customer: null };
    }
  }
);

/**
 * Browser tab title for a member page: "MA001 - La Moreliana Meat Market". Pending members have
 * no MA# yet, and a member without a business name falls back to the contact name. Returns no
 * title (the app default applies) when the customer can't be loaded.
 */
export async function memberPageMetadata(params: Promise<{ id: string }>): Promise<Metadata> {
  const { id } = await params;
  const { customer } = await loadCustomer(id);
  if (!customer) return {};
  const name = customer.businessName?.trim() || customer.contactName?.trim();
  const title = [customer.memberId?.trim(), name].filter(Boolean).join(" - ");
  return title ? { title } : {};
}
