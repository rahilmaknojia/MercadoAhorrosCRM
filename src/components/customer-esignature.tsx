"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import {
  refreshEsignatureDocument,
  sendEsignatureDocument,
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
} from "@/lib/types";
import { Loader2, RefreshCw, Send } from "lucide-react";

function manualRoles(t: EsignatureTemplate) {
  try {
    const m = JSON.parse(t.mappingJson) as EsignatureTemplateMapping;
    return (m.roles ?? []).filter((r) => r.source === "manual");
  } catch {
    return [];
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
}: {
  customerId: number;
  templates: EsignatureTemplate[];
  documents: EsignatureDocument[];
}) {
  const canSend = useCan("customer_data:create");

  return (
    <div className="space-y-4">
      {canSend && templates.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Send a document</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {templates.map((t) => (
              <TemplateSender key={t.id} customerId={customerId} template={t} />
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
                <DocumentRow key={d.id} customerId={customerId} document={d} />
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function TemplateSender({ customerId, template }: { customerId: number; template: EsignatureTemplate }) {
  const roles = manualRoles(template);
  const [recipients, setRecipients] = useState<Record<string, EsignatureManualRecipient>>({});
  const [sendNow, setSendNow] = useState(false);
  const [pending, startTransition] = useTransition();

  function setField(roleKey: string, field: "name" | "email", value: string) {
    setRecipients((prev) => ({ ...prev, [roleKey]: { ...prev[roleKey], roleKey, [field]: value } }));
  }

  function send() {
    for (const role of roles) {
      if (!recipients[role.roleKey]?.email?.trim()) {
        return toast.error(`Enter an email for ${role.label || role.roleKey}.`);
      }
    }
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

  return (
    <div className="rounded-md border p-3 space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-medium">{template.name}</span>
        <div className="ml-auto flex items-center gap-3">
          <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <input type="checkbox" checked={sendNow} onChange={(e) => setSendNow(e.target.checked)} />
            Email signers now
          </label>
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

function DocumentRow({ customerId, document }: { customerId: number; document: EsignatureDocument }) {
  const [pending, startTransition] = useTransition();

  function refresh() {
    startTransition(async () => {
      const res = await refreshEsignatureDocument(customerId, document.id);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
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
      <Button variant="ghost" size="sm" onClick={refresh} disabled={pending} title="Refresh status">
        {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
      </Button>
    </div>
  );
}
