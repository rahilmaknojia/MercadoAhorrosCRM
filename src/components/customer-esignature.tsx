"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  deleteEsignatureDocument,
  getEsignatureDocumentChanges,
  launchInPersonSigning,
  refreshEsignatureDocument,
  sendEsignatureDocument,
  startInPersonFromTemplate,
  updateEsignatureDocumentDetails,
} from "@/app/(app)/customers/[id]/esignature-actions";
import { saveCustomerSignature } from "@/app/(app)/customers/onboard/actions";
import { CustomerSignatureCard } from "@/components/customer-signature-card";
import { useCan } from "@/components/permissions-provider";
import { PdfViewerModal } from "@/components/pdf-viewer-modal";
import { useFileDownload } from "@/lib/download";
import { SignaturePad } from "@/components/signature-pad";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EsignatureSendDialog } from "@/components/esignature-send-dialog";
import { EsignatureUpdateDetailsDialog } from "@/components/esignature-update-details-dialog";
import { cn } from "@/lib/utils";
import { sortTemplatesForDisplay, tagBadgeClass } from "@/lib/esign";
import { parseTemplateMapping, snapshotChipLabel } from "@/lib/esign-survey";
import type {
  EsignatureDocument,
  EsignatureDocumentRecipient,
  EsignatureManualRecipient,
  EsignatureMergeChanges,
  EsignatureTemplate,
} from "@/lib/types";
import { ClipboardCheck, Download, Eye, FileDiff, Loader2, PenLine, RefreshCw, Send, Trash2, X } from "lucide-react";

// The active in-person session: the signing url (a short-lived credential, kept only in memory)
// plus which document it belongs to, so we can re-sync that document's status when it closes.
type ActiveSession = { url: string; documentId: number };
type Signer = { name: string; email: string };

function mappingRoles(t: EsignatureTemplate) {
  return parseTemplateMapping(t.mappingJson).roles;
}

function manualRoles(t: EsignatureTemplate) {
  return mappingRoles(t).filter((r) => r.source === "manual");
}

// Signature-on-file only pre-fills a role bound to the customer; templates without one skip it.
function hasCustomerRole(t: EsignatureTemplate): boolean {
  return mappingRoles(t).some((r) => r.source === "customer");
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

// Where this customer stands on one template: signed, out for signature, or not started. A
// declined/voided/expired document doesn't count — the document still has to be done.
type TemplateStatus = "completed" | "inProgress" | "notStarted";
function templateStatus(template: EsignatureTemplate, documents: EsignatureDocument[]): TemplateStatus {
  const docs = documents.filter((d) => d.esignatureTemplateId === template.id);
  if (docs.some(isCompleted)) return "completed";
  if (docs.some((d) => isSignable(d.status))) return "inProgress";
  return "notStarted";
}

const STATUS_CHIP: Record<TemplateStatus, { label: string; className: string }> = {
  completed: { label: "Completed", className: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400" },
  inProgress: { label: "In progress", className: "bg-amber-500/15 text-amber-700 dark:text-amber-400" },
  notStarted: { label: "Not started", className: "bg-muted text-muted-foreground" },
};

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
  initialSignature,
}: {
  customerId: number;
  templates: EsignatureTemplate[];
  documents: EsignatureDocument[];
  currentUser: Signer | null;
  orgUsers: Signer[];
  initialSignature: string | null;
}) {
  const canSend = useCan("customer_data:create");
  const canDelete = useCan("customer_data:delete");
  const router = useRouter();
  const [session, setSession] = useState<ActiveSession | null>(null);
  // The checklist: required templates first (numbered, in the admin's order), optional below.
  const orderedTemplates = useMemo(() => sortTemplatesForDisplay(templates), [templates]);
  const requiredTemplates = orderedTemplates.filter((t) => t.isRequired);
  const optionalTemplates = orderedTemplates.filter((t) => !t.isRequired);
  const requiredDone = requiredTemplates.filter((t) => templateStatus(t, documents) === "completed").length;

  // Signature-on-file, shared by the card and the in-person check so a capture in either shows in both.
  const [signature, setSignature] = useState<string | null>(initialSignature);
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
      <CustomerSignatureCard
        customerId={customerId}
        signature={signature}
        onSignatureChange={setSignature}
      />

      {templates.length > 0 && (
        <Card>
          <CardHeader className="space-y-2">
            <CardTitle>{requiredTemplates.length > 0 ? "Documents to complete" : "Send a document"}</CardTitle>
            {requiredTemplates.length > 0 && (
              <div className="space-y-1.5">
                <p className="text-sm text-muted-foreground">
                  {requiredDone === requiredTemplates.length
                    ? "All required documents are complete."
                    : `${requiredDone} of ${requiredTemplates.length} required documents complete — work through them in order.`}
                </p>
                <div
                  className="h-1.5 w-full overflow-hidden rounded-full bg-muted"
                  role="progressbar"
                  aria-label="Required documents complete"
                  aria-valuemin={0}
                  aria-valuemax={requiredTemplates.length}
                  aria-valuenow={requiredDone}
                >
                  <div
                    className="h-full rounded-full bg-emerald-500 transition-[width]"
                    style={{ width: `${(requiredDone / requiredTemplates.length) * 100}%` }}
                  />
                </div>
              </div>
            )}
          </CardHeader>
          <CardContent className="space-y-5">
            {[
              { title: "Required", list: requiredTemplates, numbered: true },
              { title: "Optional", list: optionalTemplates, numbered: false },
            ]
              .filter((s) => s.list.length > 0)
              .map((s) => (
                <div key={s.title} className="space-y-3">
                  {/* Only label the sections when there is more than one kind. */}
                  {requiredTemplates.length > 0 && optionalTemplates.length > 0 && (
                    <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      {s.title}
                    </h3>
                  )}
                  {s.list.map((t, i) => (
                    <TemplateSender
                      key={t.id}
                      customerId={customerId}
                      template={t}
                      step={s.numbered ? i + 1 : null}
                      status={templateStatus(t, documents)}
                      canSend={canSend}
                      onSession={setSession}
                      currentUser={currentUser}
                      orgUsers={orgUsers}
                      signature={signature}
                      onSignatureChange={setSignature}
                    />
                  ))}
                </div>
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
  step,
  status,
  canSend,
  onSession,
  currentUser,
  orgUsers,
  signature,
  onSignatureChange,
}: {
  customerId: number;
  template: EsignatureTemplate;
  /** Position in the required checklist (1-based); null for optional templates. */
  step: number | null;
  status: TemplateStatus;
  /** Without send permission the row is a read-only checklist entry. */
  canSend: boolean;
  onSession: (s: ActiveSession) => void;
  currentUser: Signer | null;
  orgUsers: Signer[];
  signature: string | null;
  onSignatureChange: (dataUrl: string) => void;
}) {
  const roles = manualRoles(template);
  const hasMergeTokens = parseTemplateMapping(template.mappingJson).mergeTokens.length > 0;
  const canCaptureSignature = useCan("customer_data:update");
  // The confirm step (merge preview + compliance review pin; for in-person also the check that
  // confirms or captures the customer's signature before launching).
  const [dialog, setDialog] = useState<"send" | "inPerson" | null>(null);
  const [useSignatureOnFile, setUseSignatureOnFile] = useState(true);
  const [savingSignature, setSavingSignature] = useState(false);

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
    // Nothing to preview without merge fields — send straight away, as before.
    if (!hasMergeTokens) {
      doSend(null);
      return;
    }
    setDialog("send");
  }

  function doSend(complianceReviewVersion: number | null) {
    startTransition(async () => {
      const res = await sendEsignatureDocument(
        customerId,
        template.id,
        Object.values(recipients),
        sendNow,
        complianceReviewVersion
      );
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(sendNow ? "Document sent for signature." : "Draft created.");
      setRecipients({});
      setSendNow(false);
      setDialog(null);
    });
  }

  function signInPerson() {
    if (missingManual()) return;
    // No customer role (nothing to pre-fill) and no merge fields (nothing to preview) — launch now.
    if (!hasCustomerRole(template) && !hasMergeTokens) {
      startSigning(false, null);
      return;
    }
    setUseSignatureOnFile(true);
    setDialog("inPerson");
  }

  // Launch the in-person session. With `prefill`, the API supplies the signature on file to
  // NinjaFlow (the customer still reviews and submits); without it they draw it in the document.
  function startSigning(prefill: boolean, complianceReviewVersion: number | null) {
    startTransition(async () => {
      const res = await startInPersonFromTemplate(
        customerId,
        template.id,
        Object.values(recipients),
        prefill,
        complianceReviewVersion
      );
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      setRecipients({});
      setDialog(null);
      onSession({ url: res.data.session.url, documentId: res.data.documentId });
    });
  }

  const prefillSignature = hasCustomerRole(template) && !!signature && useSignatureOnFile;

  async function captureSignature(dataUrl: string) {
    setSavingSignature(true);
    const res = await saveCustomerSignature(customerId, dataUrl);
    setSavingSignature(false);
    if (!res.ok) {
      toast.error(res.error ?? "Could not save the signature.");
      return;
    }
    onSignatureChange(dataUrl);
    setUseSignatureOnFile(true);
    toast.success("Signature saved.");
  }

  return (
    <div className={cn("rounded-md border p-3 space-y-2", status === "completed" && "border-emerald-500/30 bg-emerald-500/5")}>
      <div className="flex flex-wrap items-center gap-2">
        {step !== null && (
          <span
            className={cn(
              "flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold",
              status === "completed" ? "bg-emerald-500 text-white" : "bg-primary/10 text-primary"
            )}
            aria-label={`Step ${step}`}
          >
            {status === "completed" ? "✓" : step}
          </span>
        )}
        <span className="text-sm font-medium">{template.name}</span>
        <span className={cn("rounded-full px-2 py-0.5 text-xs font-medium", STATUS_CHIP[status].className)}>
          {STATUS_CHIP[status].label}
        </span>
        {canSend && (
        <div className="ml-auto flex items-center gap-3">
          <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <input type="checkbox" checked={sendNow} onChange={(e) => setSendNow(e.target.checked)} />
            Email signers now
          </label>
          <Button
            variant="outline"
            size="sm"
            onClick={signInPerson}
            disabled={pending || dialog !== null}
            className="gap-1.5"
          >
            <PenLine className="h-3.5 w-3.5" />
            Sign in person
          </Button>
          <Button size="sm" onClick={send} disabled={pending || dialog !== null} className="gap-1.5">
            {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
            Send
          </Button>
        </div>
        )}
      </div>
      {canSend && roles.length > 0 && (
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
      <EsignatureSendDialog
        open={dialog === "send"}
        onOpenChange={(open) => !open && setDialog(null)}
        customerId={customerId}
        template={template}
        title={`${sendNow ? "Send" : "Create draft of"} ${template.name}`}
        description={
          sendNow
            ? "Review what will be filled in, then email the signers."
            : "Review what will be filled in. A draft is created; no emails are sent yet."
        }
        confirmLabel={sendNow ? "Send" : "Create draft"}
        confirmIcon={<Send className="size-3.5" />}
        pending={pending}
        onConfirm={doSend}
        onCancel={() => setDialog(null)}
      />
      <EsignatureSendDialog
        open={dialog === "inPerson"}
        onOpenChange={(open) => !open && setDialog(null)}
        customerId={customerId}
        template={template}
        title={`Sign ${template.name} in person`}
        description="Review what will be filled in, then hand the device to the signer."
        confirmLabel={
          !hasCustomerRole(template) || prefillSignature ? "Start signing" : "Continue — customer signs in document"
        }
        confirmIcon={<PenLine className="size-3.5" />}
        pending={pending}
        confirmDisabled={savingSignature}
        onConfirm={(version) => startSigning(prefillSignature, version)}
        onCancel={() => setDialog(null)}
      >
        {hasCustomerRole(template) && (
          <div className="space-y-3 rounded-md border bg-muted/30 p-3">
            <span className="text-sm font-medium">Customer signature</span>
            {signature ? (
              <>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={signature}
                  alt="Customer signature on file"
                  className="h-16 w-auto rounded-md border bg-white p-1"
                />
                <label className="flex items-start gap-2 text-sm">
                  <input
                    type="checkbox"
                    className="mt-0.5"
                    checked={useSignatureOnFile}
                    onChange={(e) => setUseSignatureOnFile(e.target.checked)}
                  />
                  <span>
                    Pre-fill the document with this signature. The customer still reviews and
                    submits, and can redraw it.
                  </span>
                </label>
              </>
            ) : (
              <>
                <p className="text-sm text-muted-foreground">
                  No signature on file.{" "}
                  {canCaptureSignature
                    ? "Capture it now to pre-fill the document, or continue and the customer signs in the document."
                    : "The customer will sign in the document."}
                </p>
                {canCaptureSignature && (
                  <SignaturePad onSave={captureSignature} saving={savingSignature} />
                )}
              </>
            )}
          </div>
        )}
      </EsignatureSendDialog>
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
  // Older API builds may expose the raw column (sourceSnapshotJson) instead of the parsed object.
  const snapshotChip = snapshotChipLabel(
    document.sourceSnapshot ?? (document as { sourceSnapshotJson?: string | null }).sourceSnapshotJson
  );
  const basePath = `/customers/${customerId}/esignature/${document.id}/download`;

  // Full signed PDF (skip-export lives in the viewer). Fetched in the background so the button can
  // show progress while NinjaFlow prepares the file.
  const { downloading, download } = useFileDownload();
  function downloadPdf() {
    void download(`${basePath}?download=true`, `${document.name || "signed-document"}.pdf`);
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

  // "Update details" needs customer_data:update; without it, resuming just goes straight to signing.
  const canUpdate = useCan("customer_data:update");
  const updatable = canUpdate && isSignable(document.status) && document.esignatureTemplateId != null;
  const [detailsDialog, setDetailsDialog] = useState<{
    mode: "resume" | "manual";
    changes: EsignatureMergeChanges;
  } | null>(null);
  const [busy, setBusy] = useState<"sign" | "details" | "update" | null>(null);

  async function launch() {
    const res = await launchInPersonSigning(document.id);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    onSession({ url: res.data.session.url, documentId: res.data.documentId });
  }

  // Resuming in-person signing: if the customer's details changed since the document was created,
  // ask before opening it. A failed check never blocks signing — it just opens the document.
  function signInPerson() {
    startTransition(async () => {
      setBusy("sign");
      try {
        if (updatable) {
          const check = await getEsignatureDocumentChanges(document.id);
          if (check.ok && check.data.updatable && check.data.tracked && check.data.changes.length > 0) {
            setDetailsDialog({ mode: "resume", changes: check.data });
            return;
          }
        }
        await launch();
      } finally {
        setBusy(null);
      }
    });
  }

  function openDetails() {
    startTransition(async () => {
      setBusy("details");
      const check = await getEsignatureDocumentChanges(document.id);
      setBusy(null);
      if (!check.ok) {
        toast.error(check.error);
        return;
      }
      if (!check.data.updatable) {
        toast.info(check.data.notUpdatableReason ?? "This document can no longer change.");
        return;
      }
      setDetailsDialog({ mode: "manual", changes: check.data });
    });
  }

  function updateDetails() {
    const mode = detailsDialog?.mode;
    startTransition(async () => {
      setBusy("update");
      const res = await updateEsignatureDocumentDetails(customerId, document.id);
      if (!res.ok) {
        setBusy(null);
        toast.error(res.error);
        return;
      }
      const { updated, skipped } = res.data;
      if (updated.length > 0) {
        toast.success(`Document updated with ${updated.length} new ${updated.length === 1 ? "detail" : "details"}.`);
      } else if (skipped.length === 0) {
        toast.info("The document already had the latest details.");
      }
      if (skipped.length > 0) {
        toast.warning(
          `${skipped.length} ${skipped.length === 1 ? "detail was" : "details were"} kept as they were: ` +
            skipped.map((s) => `${s.token} (${SKIP_REASON[s.reason] ?? s.reason})`).join(", ") +
            ". To change a signed part, void this document and send a new one.",
          { duration: 10000 }
        );
      }
      setDetailsDialog(null);
      if (mode === "resume") await launch();
      setBusy(null);
      router.refresh();
    });
  }

  function continueWithoutUpdating() {
    setDetailsDialog(null);
    startTransition(async () => {
      setBusy("sign");
      await launch();
      setBusy(null);
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
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
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
            {snapshotChip && (
              <span
                className="inline-flex items-center gap-1 rounded bg-muted px-1.5 py-0.5 font-medium"
                title="The compliance review this document was filled from"
              >
                <ClipboardCheck className="size-3" />
                {snapshotChip}
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
            <Button
              variant="ghost"
              size="sm"
              onClick={downloadPdf}
              disabled={downloading}
              aria-busy={downloading}
              title={downloading ? "Preparing download…" : "Download signed PDF"}
              className="gap-1.5"
            >
              {downloading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span className="text-xs">Preparing…</span>
                </>
              ) : (
                <Download className="h-4 w-4" />
              )}
            </Button>
          </>
        )}
        {signable && (
          <Button variant="outline" size="sm" onClick={signInPerson} disabled={pending} className="gap-1.5">
            {busy === "sign" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <PenLine className="h-3.5 w-3.5" />}
            Sign in person
          </Button>
        )}
        {updatable && (
          <Button
            variant="ghost"
            size="sm"
            onClick={openDetails}
            disabled={pending}
            title="Update with the customer's latest details"
            className="gap-1.5"
          >
            {busy === "details" ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileDiff className="h-4 w-4" />}
            <span className="hidden sm:inline">Update details</span>
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

      <EsignatureUpdateDetailsDialog
        open={detailsDialog !== null}
        onOpenChange={(open) => !open && setDetailsDialog(null)}
        mode={detailsDialog?.mode ?? "manual"}
        documentName={document.name}
        changes={detailsDialog?.changes ?? null}
        pending={busy === "update"}
        onUpdate={updateDetails}
        onContinue={continueWithoutUpdating}
      />
    </div>
  );
}

// Why NinjaFlow kept a value as it was, in plain words.
const SKIP_REASON: Record<string, string> = {
  recipient_signed: "already signed",
  envelope_signed: "someone has already signed",
  edited_by_signer: "the signer changed it themselves",
};

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
