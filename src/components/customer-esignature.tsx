"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  launchInPersonSigning,
  refreshEsignatureDocument,
  sendEsignatureDocument,
  startInPersonFromTemplate,
} from "@/app/(app)/customers/[id]/esignature-actions";
import { useCan } from "@/components/permissions-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type {
  EsignatureDocument,
  EsignatureManualRecipient,
  EsignatureTemplate,
  EsignatureTemplateMapping,
  SigningSession,
} from "@/lib/types";
import { Loader2, PenLine, RefreshCw, Send, X } from "lucide-react";

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
}: {
  customerId: number;
  templates: EsignatureTemplate[];
  documents: EsignatureDocument[];
}) {
  const canSend = useCan("customer_data:create");
  const router = useRouter();
  // The active in-person signing session (its url is a short-lived credential — kept only in
  // memory while the overlay is open, never persisted).
  const [session, setSession] = useState<SigningSession | null>(null);

  function closeSigning() {
    setSession(null);
    router.refresh(); // status may have advanced while signing
  }

  return (
    <div className="space-y-4">
      {canSend && templates.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Send a document</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {templates.map((t) => (
              <TemplateSender key={t.id} customerId={customerId} template={t} onSession={setSession} />
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
            <div className="space-y-2">
              {documents.map((d) => (
                <DocumentRow
                  key={d.id}
                  customerId={customerId}
                  document={d}
                  canSign={canSend}
                  onSession={setSession}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {session && <SigningOverlay url={session.url} onClose={closeSigning} />}
    </div>
  );
}

function TemplateSender({
  customerId,
  template,
  onSession,
}: {
  customerId: number;
  template: EsignatureTemplate;
  onSession: (s: SigningSession) => void;
}) {
  const roles = manualRoles(template);
  const [recipients, setRecipients] = useState<Record<string, EsignatureManualRecipient>>({});
  const [sendNow, setSendNow] = useState(false);
  const [pending, startTransition] = useTransition();

  function setField(roleKey: string, field: "name" | "email", value: string) {
    setRecipients((prev) => ({ ...prev, [roleKey]: { ...prev[roleKey], roleKey, [field]: value } }));
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
      onSession(res.data);
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
        <div className="grid gap-2 sm:grid-cols-2">
          {roles.map((role) => (
            <div key={role.roleKey} className="grid grid-cols-2 gap-1.5">
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
  onSession,
}: {
  customerId: number;
  document: EsignatureDocument;
  canSign: boolean;
  onSession: (s: SigningSession) => void;
}) {
  const [pending, startTransition] = useTransition();
  const signable = canSign && isSignable(document.status);

  function refresh() {
    startTransition(async () => {
      const res = await refreshEsignatureDocument(customerId, document.id);
      if (!res.ok) toast.error(res.error);
    });
  }

  function signInPerson() {
    startTransition(async () => {
      const res = await launchInPersonSigning(document.id);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      onSession(res.data);
    });
  }

  return (
    <div className="flex items-center gap-3 rounded-md border p-3">
      <div className="min-w-0">
        <div className="truncate text-sm font-medium">{document.name}</div>
        <div className="text-xs text-muted-foreground">
          {document.lastSyncedOn
            ? `Updated ${new Date(document.lastSyncedOn).toLocaleString()}`
            : document.createdOn
              ? `Created ${new Date(document.createdOn).toLocaleString()}`
              : ""}
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
      {signable && (
        <Button variant="outline" size="sm" onClick={signInPerson} disabled={pending} className="gap-1.5">
          <PenLine className="h-3.5 w-3.5" />
          Sign in person
        </Button>
      )}
      <Button variant="ghost" size="sm" onClick={refresh} disabled={pending} title="Refresh status">
        {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
      </Button>
    </div>
  );
}

// Full-screen embedded signing surface (reuses the app's fixed-overlay pattern). The signer signs
// on the rep's device; closing returns to the tab and re-pulls the document status.
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
