"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  deleteEsignatureDocument,
  launchInPersonSigning,
  refreshEsignatureDocument,
  sendEsignatureDocument,
  startInPersonFromTemplate,
} from "@/app/(app)/customers/[id]/esignature-actions";
import { useCan } from "@/components/permissions-provider";
import { PdfViewerModal } from "@/components/pdf-viewer-modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { tagBadgeClass } from "@/lib/esign";
import type {
  EsignatureDocument,
  EsignatureDocumentRecipient,
  EsignatureManualRecipient,
  EsignatureTemplate,
  EsignatureTemplateMapping,
} from "@/lib/types";
import { Download, Eye, Loader2, PenLine, RefreshCw, Send, Trash2, X } from "lucide-react";

// The active in-person session: the signing url (a short-lived credential, kept only in memory)
// plus which document it belongs to, so we can re-sync that document's status when it closes.
type ActiveSession = { url: string; documentId: number };
type Signer = { name: string; email: string };

function manualRoles(t: EsignatureTemplate) {
  try {
    const m = JSON.parse(t.mappingJson) as EsignatureTemplateMapping;
    return (m.roles ?? []).filter((r) => r.source === "manual");
  } catch {
    return [];
  }
}

const TERMINAL = new Set(["completed", "signed", "voided", "declined", "expired"]);
function isSignable(status: string): boolean {
  return !TERMINAL.has(status.toLowerCase());
}

// Tag filter sentinels + when to switch from tabs to a dropdown.
const ALL_TAGS = "__all__";
const UNTAGGED = "__untagged__";
const TAG_TABS_LIMIT = 10; // <= this many distinct tags => tabs; more => dropdown filter
const selectClass =
  "h-9 rounded-md border border-input bg-transparent px-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50";

// A sealed PDF exists once the envelope is completed/signed.
function isCompleted(doc: EsignatureDocument): boolean {
  return ["completed", "signed"].includes(doc.status.toLowerCase()) || doc.hasSignedPdf;
}

// Progress across the actual signers (CarbonCopy recipients don't sign, so they don't count).
function signProgress(recipientsJson?: string | null): { signed: number; total: number } | null {
  if (!recipientsJson) return null;
  try {
    const recipients = JSON.parse(recipientsJson) as EsignatureDocumentRecipient[];
    const signers = recipients.filter((r) => (r.role ?? "").toLowerCase() !== "carboncopy");
    if (signers.length === 0) return null;
    const done = signers.filter((r) =>
      ["signed", "completed"].includes((r.status ?? "").toLowerCase())
    ).length;
    return { signed: done, total: signers.length };
  } catch {
    return null;
  }
}

function statusClass(status: string): string {
  const s = status.toLowerCase();
  if (s === "completed" || s === "signed") return "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400";
  if (s === "voided" || s === "declined" || s === "expired") return "bg-destructive/15 text-destructive";
  if (s === "draft") return "bg-muted text-muted-foreground";
  return "bg-primary/10 text-primary"; // sent / delivered / in progress
}

export function CustomerESignature({
  customerId,
  templates,
  documents,
  currentUser,
  orgUsers,
}: {
  customerId: number;
  templates: EsignatureTemplate[];
  documents: EsignatureDocument[];
  currentUser: Signer | null;
  orgUsers: Signer[];
}) {
  const canSend = useCan("customer_data:create");
  const canDelete = useCan("customer_data:delete");
  const router = useRouter();
  const [session, setSession] = useState<ActiveSession | null>(null);
  const [activeTag, setActiveTag] = useState<string>(ALL_TAGS);
  // Advanced filters (client-side — a customer has few documents): by status and by the
  // Updated/Created date. Initial state is "no filter", so SSR and the first client render agree.
  const [statusFilter, setStatusFilter] = useState<Set<string>>(new Set());
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  async function closeSigning() {
    const active = session;
    setSession(null);
    // Pull the latest status from NinjaFlow so a just-completed signature shows up.
    if (active) await refreshEsignatureDocument(customerId, active.documentId);
    router.refresh();
  }

  // Distinct statuses present, for the status filter chips.
  const availableStatuses = useMemo(() => {
    const set = new Set<string>();
    for (const d of documents) if (d.status) set.add(d.status);
    return [...set].sort((a, b) => a.localeCompare(b));
  }, [documents]);

  function toggleStatus(status: string) {
    setStatusFilter((prev) => {
      const next = new Set(prev);
      if (next.has(status)) next.delete(status);
      else next.add(status);
      return next;
    });
  }

  const hasActiveFilters = statusFilter.size > 0 || fromDate !== "" || toDate !== "";

  function clearFilters() {
    setStatusFilter(new Set());
    setFromDate("");
    setToDate("");
  }

  // Apply status + date filters first; the tag view (grouping, counts, tabs) is built from the
  // result, so tag counts reflect the active filters. Date compares against Updated (lastSyncedOn)
  // and falls back to Created; the day bounds are inclusive.
  const visibleDocuments = useMemo(() => {
    const from = fromDate ? new Date(`${fromDate}T00:00:00`).getTime() : null;
    const to = toDate ? new Date(`${toDate}T23:59:59.999`).getTime() : null;
    return documents.filter((d) => {
      if (statusFilter.size > 0 && !statusFilter.has(d.status)) return false;
      if (from !== null || to !== null) {
        const raw = d.lastSyncedOn ?? d.createdOn;
        if (!raw) return false;
        const t = new Date(raw).getTime();
        if (from !== null && t < from) return false;
        if (to !== null && t > to) return false;
      }
      return true;
    });
  }, [documents, statusFilter, fromDate, toDate]);

  // Group documents by their (single) tag so the list reads as a tag view. Untagged last.
  const groupedByTag = useMemo(() => {
    const map = new Map<string, EsignatureDocument[]>();
    for (const d of visibleDocuments) {
      const key = d.tag?.trim() || "";
      const existing = map.get(key);
      if (existing) existing.push(d);
      else map.set(key, [d]);
    }
    return [...map.entries()].sort((a, b) =>
      a[0] === "" ? 1 : b[0] === "" ? -1 : a[0].localeCompare(b[0])
    );
  }, [visibleDocuments]);

  // Distinct tags + counts drive the tag filter. Few tags => tabs; many => a dropdown.
  const tagInfo = useMemo(() => {
    const counts = new Map<string, number>();
    let untagged = 0;
    for (const d of visibleDocuments) {
      const t = d.tag?.trim();
      if (t) counts.set(t, (counts.get(t) ?? 0) + 1);
      else untagged++;
    }
    const tags = [...counts.entries()].sort((a, b) => a[0].localeCompare(b[0]));
    return { tags, untagged };
  }, [visibleDocuments]);

  const tabOptions = [
    { value: ALL_TAGS, label: "All", count: visibleDocuments.length },
    ...tagInfo.tags.map(([t, c]) => ({ value: t, label: t, count: c })),
    ...(tagInfo.untagged > 0 ? [{ value: UNTAGGED, label: "Untagged", count: tagInfo.untagged }] : []),
  ];
  const useTabs = tagInfo.tags.length <= TAG_TABS_LIMIT;

  const filteredDocs = useMemo(() => {
    if (activeTag === ALL_TAGS) return visibleDocuments;
    if (activeTag === UNTAGGED) return visibleDocuments.filter((d) => !d.tag?.trim());
    return visibleDocuments.filter((d) => d.tag?.trim() === activeTag);
  }, [visibleDocuments, activeTag]);

  return (
    <div className="space-y-4">
      {canSend && templates.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Send a document</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {templates.map((t) => (
              <TemplateSender
                key={t.id}
                customerId={customerId}
                template={t}
                onSession={setSession}
                currentUser={currentUser}
                orgUsers={orgUsers}
              />
            ))}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Documents</CardTitle>
        </CardHeader>
        <CardContent>
          {documents.length === 0 ? (
            <p className="text-sm text-muted-foreground">No documents yet.</p>
          ) : (
            <div className="space-y-3">
              {/* Advanced filters: status chips + an Updated/Created date range. Client-side, so
                  the tag tabs above and the list below both reflect the current selection. */}
              <div className="space-y-2 rounded-md border bg-muted/30 p-3">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-xs font-medium text-muted-foreground">Status</span>
                  {availableStatuses.map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => toggleStatus(s)}
                      className={cn(
                        "rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors",
                        statusFilter.has(s)
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-transparent text-muted-foreground hover:bg-muted"
                      )}
                    >
                      {s}
                    </button>
                  ))}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs font-medium text-muted-foreground">Date</span>
                  <input
                    type="date"
                    aria-label="From date"
                    value={fromDate}
                    max={toDate || undefined}
                    onChange={(e) => setFromDate(e.target.value)}
                    className={selectClass}
                  />
                  <span className="text-xs text-muted-foreground">to</span>
                  <input
                    type="date"
                    aria-label="To date"
                    value={toDate}
                    min={fromDate || undefined}
                    onChange={(e) => setToDate(e.target.value)}
                    className={selectClass}
                  />
                  {hasActiveFilters && (
                    <button
                      type="button"
                      onClick={clearFilters}
                      className="ml-auto text-xs text-muted-foreground underline-offset-2 hover:underline"
                    >
                      Clear filters
                    </button>
                  )}
                </div>
              </div>

              {visibleDocuments.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No documents match the current filters.
                </p>
              ) : (
                <>
              {tagInfo.tags.length > 0 &&
                (useTabs ? (
                  <div className="flex flex-wrap gap-1.5 border-b pb-2">
                    {tabOptions.map((opt) => (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => setActiveTag(opt.value)}
                        className={cn(
                          "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                          activeTag === opt.value
                            ? "border-primary bg-primary/10 text-primary"
                            : "border-transparent text-muted-foreground hover:bg-muted"
                        )}
                      >
                        {opt.label}
                        <span className="ml-1 opacity-70">{opt.count}</span>
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">Tag</span>
                    <select
                      className={`${selectClass} w-full max-w-xs`}
                      value={activeTag}
                      onChange={(e) => setActiveTag(e.target.value)}
                    >
                      {tabOptions.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label} ({opt.count})
                        </option>
                      ))}
                    </select>
                  </div>
                ))}

              {activeTag === ALL_TAGS ? (
                <div className="space-y-4">
                  {groupedByTag.map(([tag, docs]) => (
                    <div key={tag || "__untagged__"} className="space-y-2">
                      <div className="flex items-center gap-2">
                        {tag ? (
                          <span
                            className={cn(
                              "rounded-full px-2 py-0.5 text-xs font-medium",
                              tagBadgeClass(tag)
                            )}
                          >
                            {tag}
                          </span>
                        ) : (
                          <span className="text-xs font-medium text-muted-foreground">Untagged</span>
                        )}
                        <span className="text-xs text-muted-foreground">{docs.length}</span>
                      </div>
                      {docs.map((d) => (
                        <DocumentRow
                          key={d.id}
                          customerId={customerId}
                          document={d}
                          canSign={canSend}
                          canDelete={canDelete}
                          onSession={setSession}
                        />
                      ))}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="space-y-2">
                  {filteredDocs.map((d) => (
                    <DocumentRow
                      key={d.id}
                      customerId={customerId}
                      document={d}
                      canSign={canSend}
                      canDelete={canDelete}
                      onSession={setSession}
                    />
                  ))}
                </div>
              )}
                </>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {session && <SigningOverlay url={session.url} onClose={closeSigning} />}
    </div>
  );
}

const CUSTOM_SIGNER = "__custom__";

function TemplateSender({
  customerId,
  template,
  onSession,
  currentUser,
  orgUsers,
}: {
  customerId: number;
  template: EsignatureTemplate;
  onSession: (s: ActiveSession) => void;
  currentUser: Signer | null;
  orgUsers: Signer[];
}) {
  const roles = manualRoles(template);

  // Users pickable for a manual role: the logged-in user first ("Me"), then other org users.
  const userOptions = useMemo(() => {
    const opts: { value: string; label: string; name: string; email: string }[] = [];
    const seen = new Set<string>();
    if (currentUser?.email) {
      opts.push({
        value: currentUser.email,
        label: `Me — ${currentUser.name || currentUser.email}`,
        name: currentUser.name,
        email: currentUser.email,
      });
      seen.add(currentUser.email.toLowerCase());
    }
    for (const u of orgUsers) {
      if (!u.email || seen.has(u.email.toLowerCase())) continue;
      seen.add(u.email.toLowerCase());
      opts.push({ value: u.email, label: `${u.name} — ${u.email}`, name: u.name, email: u.email });
    }
    return opts;
  }, [currentUser, orgUsers]);

  // Prefill each manual role with the logged-in user so the rep is filled in by default.
  const [recipients, setRecipients] = useState<Record<string, EsignatureManualRecipient>>(() => {
    const init: Record<string, EsignatureManualRecipient> = {};
    if (currentUser?.email) {
      for (const role of roles) {
        init[role.roleKey] = { roleKey: role.roleKey, name: currentUser.name, email: currentUser.email };
      }
    }
    return init;
  });
  const [sendNow, setSendNow] = useState(false);
  const [pending, startTransition] = useTransition();

  function setField(roleKey: string, field: "name" | "email", value: string) {
    setRecipients((prev) => ({ ...prev, [roleKey]: { ...prev[roleKey], roleKey, [field]: value } }));
  }

  function pickerValue(roleKey: string): string {
    const email = recipients[roleKey]?.email?.trim().toLowerCase();
    const match = userOptions.find((o) => o.email.toLowerCase() === email);
    return match ? match.value : CUSTOM_SIGNER;
  }

  function pickUser(roleKey: string, value: string) {
    if (value === CUSTOM_SIGNER) {
      setRecipients((prev) => ({ ...prev, [roleKey]: { roleKey, name: "", email: "" } }));
      return;
    }
    const opt = userOptions.find((o) => o.value === value);
    if (opt) setRecipients((prev) => ({ ...prev, [roleKey]: { roleKey, name: opt.name, email: opt.email } }));
  }

  function missingManual(): boolean {
    for (const role of roles) {
      if (!recipients[role.roleKey]?.email?.trim()) {
        toast.error(`Enter an email for ${role.label || role.roleKey}.`);
        return true;
      }
    }
    return false;
  }

  function send() {
    if (missingManual()) return;
    startTransition(async () => {
      const res = await sendEsignatureDocument(customerId, template.id, Object.values(recipients), sendNow);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(sendNow ? "Document sent for signature." : "Draft created.");
      setRecipients({});
      setSendNow(false);
    });
  }

  function signInPerson() {
    if (missingManual()) return;
    startTransition(async () => {
      const res = await startInPersonFromTemplate(customerId, template.id, Object.values(recipients));
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      setRecipients({});
      onSession({ url: res.data.session.url, documentId: res.data.documentId });
    });
  }

  return (
    <div className="rounded-md border p-3 space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-medium">{template.name}</span>
        <div className="ml-auto flex items-center gap-3">
          <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <input type="checkbox" checked={sendNow} onChange={(e) => setSendNow(e.target.checked)} />
            Email signers now
          </label>
          <Button variant="outline" size="sm" onClick={signInPerson} disabled={pending} className="gap-1.5">
            <PenLine className="h-3.5 w-3.5" />
            Sign in person
          </Button>
          <Button size="sm" onClick={send} disabled={pending} className="gap-1.5">
            {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
            Send
          </Button>
        </div>
      </div>
      {roles.length > 0 && (
        <div className="grid gap-3 sm:grid-cols-2">
          {roles.map((role) => (
            <div key={role.roleKey} className="space-y-1.5">
              <div className="text-xs font-medium text-muted-foreground">
                {role.label || role.roleKey}
              </div>
              {userOptions.length > 0 && (
                <select
                  className={`${selectClass} w-full`}
                  value={pickerValue(role.roleKey)}
                  onChange={(e) => pickUser(role.roleKey, e.target.value)}
                >
                  {userOptions.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                  <option value={CUSTOM_SIGNER}>Someone else…</option>
                </select>
              )}
              <div className="grid grid-cols-2 gap-1.5">
                <Input
                  placeholder={`${role.label || role.roleKey} name`}
                  value={recipients[role.roleKey]?.name ?? ""}
                  onChange={(e) => setField(role.roleKey, "name", e.target.value)}
                />
                <Input
                  placeholder={`${role.label || role.roleKey} email`}
                  value={recipients[role.roleKey]?.email ?? ""}
                  onChange={(e) => setField(role.roleKey, "email", e.target.value)}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function DocumentRow({
  customerId,
  document,
  canSign,
  canDelete,
  onSession,
}: {
  customerId: number;
  document: EsignatureDocument;
  canSign: boolean;
  canDelete: boolean;
  onSession: (s: ActiveSession) => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [viewOpen, setViewOpen] = useState(false);
  const signable = canSign && isSignable(document.status);
  const completed = isCompleted(document);
  const progress = signProgress(document.recipientsJson);
  const basePath = `/customers/${customerId}/esignature/${document.id}/download`;

  function downloadPdf() {
    window.open(`${basePath}?download=true`, "_blank"); // full signed PDF (skip-export lives in the viewer)
  }

  function refresh() {
    startTransition(async () => {
      const res = await refreshEsignatureDocument(customerId, document.id);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      router.refresh();
    });
  }

  function signInPerson() {
    startTransition(async () => {
      const res = await launchInPersonSigning(document.id);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      onSession({ url: res.data.session.url, documentId: res.data.documentId });
    });
  }

  function remove() {
    if (!confirm(`Delete "${document.name}"? This removes the tracking record from the CRM.`)) return;
    startTransition(async () => {
      const res = await deleteEsignatureDocument(customerId, document.id);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success("Document removed.");
      router.refresh();
    });
  }

  return (
    <div className="space-y-2 rounded-md border p-3">
      <div className="flex items-center gap-3">
        <div className="min-w-0">
          <div className="truncate text-sm font-medium">{document.name}</div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            {/* toLocaleString() renders in the server's timezone/locale during SSR and the
                browser's on hydration, so the two disagree — React #418. Suppress the mismatch
                on this node and let the client (local-time) value win. */}
            <span suppressHydrationWarning>
              {document.lastSyncedOn
                ? `Updated ${new Date(document.lastSyncedOn).toLocaleString()}`
                : document.createdOn
                  ? `Created ${new Date(document.createdOn).toLocaleString()}`
                  : ""}
            </span>
            {progress && (
              <span className="rounded bg-muted px-1.5 py-0.5 font-medium">
                {progress.signed}/{progress.total} signed
              </span>
            )}
          </div>
        </div>
        <span
          className={cn(
            "ml-auto rounded-full px-2.5 py-0.5 text-xs font-medium",
            statusClass(document.status)
          )}
        >
          {document.status}
        </span>
        {completed && (
          <>
            <Button variant="outline" size="sm" onClick={() => setViewOpen(true)} className="gap-1.5">
              <Eye className="h-3.5 w-3.5" />
              View
            </Button>
            <Button variant="ghost" size="sm" onClick={downloadPdf} title="Download signed PDF">
              <Download className="h-4 w-4" />
            </Button>
          </>
        )}
        {signable && (
          <Button variant="outline" size="sm" onClick={signInPerson} disabled={pending} className="gap-1.5">
            <PenLine className="h-3.5 w-3.5" />
            Sign in person
          </Button>
        )}
        <Button variant="ghost" size="sm" onClick={refresh} disabled={pending} title="Refresh status">
          {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
        </Button>
        {/* Completed documents are sealed — no delete. */}
        {canDelete && !completed && (
          <Button
            variant="ghost"
            size="sm"
            onClick={remove}
            disabled={pending}
            title="Delete tracking record"
            className="text-destructive"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        )}
      </div>

      {viewOpen && (
        <PdfViewerModal
          basePath={basePath}
          title={document.name}
          onClose={() => setViewOpen(false)}
        />
      )}
    </div>
  );
}

// Full-screen embedded signing surface (reuses the app's fixed-overlay pattern). The signer signs
// on the rep's device; closing returns to the tab and re-syncs the document status.
function SigningOverlay({ url, onClose }: { url: string; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-background" role="dialog" aria-modal="true">
      <div className="flex items-center justify-between border-b px-4 py-2">
        <span className="text-sm font-medium">In-person signing</span>
        <Button variant="ghost" size="sm" onClick={onClose} className="gap-1.5">
          <X className="h-4 w-4" />
          Done
        </Button>
      </div>
      <iframe
        src={url}
        title="Sign document"
        className="min-h-0 w-full flex-1 border-0"
        allow="camera; microphone"
      />
    </div>
  );
}
