"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { apiFetch } from "@/lib/server/api";
import { sendEmail } from "@/lib/server/mailer";
import { parseDefinition } from "@/lib/report";
import type { AggregateBucket, ReportDefinition, ReportPreset } from "@/lib/types";

function parseRecipients(csv: string): string[] {
  return csv
    .split(/[,\s;]+/)
    .map((s) => s.trim())
    .filter((s) => s.includes("@"));
}

export type SaveReportPayload = {
  id?: number;
  name: string;
  description?: string;
  definition: ReportDefinition;
};

export type SaveResult = { ok: boolean; error?: string; id?: number };

export async function saveReport(payload: SaveReportPayload): Promise<SaveResult> {
  const name = payload.name.trim();
  if (!name) return { ok: false, error: "A report name is required." };

  const body = {
    name,
    description: payload.description?.trim() || null,
    queryParameters: payload.definition,
  };

  const path = payload.id ? `/api/reportpresets/${payload.id}` : "/api/reportpresets";
  const res = await apiFetch(path, {
    method: payload.id ? "PUT" : "POST",
    body: JSON.stringify(body),
  }).catch(() => null);

  if (!res) return { ok: false, error: "Your session has expired. Please sign in again." };
  if (res.status === 403) return { ok: false, error: "You don't have permission to save reports." };
  if (res.status === 409) return { ok: false, error: "A report with that name already exists." };
  if (!res.ok) return { ok: false, error: `Failed to save report (${res.status}).` };

  const saved = (await res.json().catch(() => null)) as ReportPreset | null;
  revalidatePath("/reports");
  return { ok: true, id: saved?.id ?? payload.id };
}

export async function deleteReport(id: number): Promise<void> {
  await apiFetch(`/api/reportpresets/${id}`, { method: "DELETE" }).catch(() => null);
  revalidatePath("/reports");
  redirect("/reports");
}

// Merge a partial definition into the saved report (parses the stored JSON string
// first so we don't clobber the rest of the definition).
export async function patchReportDefinition(id: number, patch: Partial<ReportDefinition>): Promise<void> {
  const res = await apiFetch(`/api/reportpresets/${id}`).catch(() => null);
  if (!res?.ok) return;
  const preset = (await res.json()) as ReportPreset;
  const definition: ReportDefinition = { ...parseDefinition(preset.queryParameters), ...patch };
  await apiFetch(`/api/reportpresets/${id}`, {
    method: "PUT",
    body: JSON.stringify({
      name: preset.name,
      description: preset.description ?? null,
      queryParameters: definition,
    }),
  }).catch(() => null);
  revalidatePath("/reports");
  revalidatePath("/");
  revalidatePath(`/reports/${id}`);
}

export async function setPinned(id: number, pinned: boolean): Promise<void> {
  await patchReportDefinition(id, { pinnedToDashboard: pinned });
}

export async function setDashboardSize(id: number, size: "small" | "large"): Promise<void> {
  await patchReportDefinition(id, { dashboardSize: size });
}

export async function saveReportEmailSettings(
  id: number,
  recipientsCsv: string,
  frequency: "none" | "daily" | "weekly"
): Promise<void> {
  await patchReportDefinition(id, {
    emailRecipients: parseRecipients(recipientsCsv),
    emailFrequency: frequency,
  });
}

// Send the report now (a summary + link) to the given recipients via SES.
export async function sendReportEmailNow(
  id: number,
  recipientsCsv: string
): Promise<{ ok: boolean; error?: string }> {
  const recipients = parseRecipients(recipientsCsv);
  if (recipients.length === 0) return { ok: false, error: "Add at least one valid email address." };

  const presetRes = await apiFetch(`/api/reportpresets/${id}`).catch(() => null);
  if (!presetRes?.ok) return { ok: false, error: "Could not load the report." };
  const preset = (await presetRes.json()) as ReportPreset;
  const def = parseDefinition(preset.queryParameters);

  const p = new URLSearchParams();
  (def.filters ?? []).forEach((f) => p.append("filters", f));
  (def.metadataFilters ?? []).forEach((f) => p.append("metadataFilters", f));

  let summary = "";
  if ((def.visualization ?? "table") === "table") {
    p.set("pageSize", "1");
    const r = await apiFetch(`/api/customers?${p.toString()}`).catch(() => null);
    const total = r?.ok ? (JSON.parse(r.headers.get("x-pagination") || "{}").TotalCount ?? 0) : 0;
    summary = `<p style="font-size:28px;font-weight:bold;margin:8px 0">${total}</p><p style="color:#71717a">matching records</p>`;
  } else {
    p.set("groupBy", def.groupBy || "status");
    const r = await apiFetch(`/api/reports/customers/aggregate?${p.toString()}`).catch(() => null);
    const buckets = r?.ok ? ((await r.json()) as AggregateBucket[]) : [];
    summary = `<table style="border-collapse:collapse">${buckets
      .slice(0, 10)
      .map(
        (b) =>
          `<tr><td style="padding:4px 12px 4px 0">${b.key}</td><td style="padding:4px 0;font-weight:bold">${b.count}</td></tr>`
      )
      .join("")}</table>`;
  }

  const crmUrl = (process.env.NEXT_PUBLIC_CRM_URL || "").replace(/\/$/, "");
  const link = crmUrl ? `<p style="margin-top:16px"><a href="${crmUrl}/reports/${id}">Open report</a></p>` : "";
  const html = `<div style="font-family:Arial,sans-serif;color:#18181b"><h2>${preset.name}</h2>${
    preset.description ? `<p style="color:#71717a">${preset.description}</p>` : ""
  }${summary}${link}</div>`;

  const result = await sendEmail({
    to: recipients,
    subject: `Mercado Ahorros report: ${preset.name}`,
    html,
    text: `${preset.name} — view in the CRM.`,
  });

  // Remember the recipients for next time.
  await patchReportDefinition(id, { emailRecipients: recipients });
  return result;
}
