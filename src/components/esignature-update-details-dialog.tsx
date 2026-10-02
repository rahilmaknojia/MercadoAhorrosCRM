"use client";

import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { EsignatureMergeChanges, EsignatureMergeUpdateResult } from "@/lib/types";

/**
 * Offers to update an in-progress document with the customer's current details.
 *
 * - "resume": shown when a rep resumes in-person signing and details have changed since the
 *   document was created. They can update first, continue as-is, or cancel.
 * - "manual": the row's "Update details" action. Also covers documents raised before change
 *   tracking, where the CRM can't list what changed but can still push the current details.
 */
export function EsignatureUpdateDetailsDialog({
  open,
  onOpenChange,
  mode,
  documentName,
  changes,
  pending,
  onUpdate,
  onContinue,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: "resume" | "manual";
  documentName: string;
  changes: EsignatureMergeChanges | null;
  pending: boolean;
  onUpdate: () => void;
  /** Resume mode only: go on to signing without updating. */
  onContinue?: () => void;
}) {
  const changed = changes?.changes ?? [];
  const tracked = changes?.tracked ?? true;
  const upToDate = tracked && changed.length === 0;

  const title =
    mode === "resume"
      ? "The customer's details have changed"
      : upToDate
        ? "This document is up to date"
        : "Update this document?";

  const description =
    mode === "resume"
      ? `Since “${documentName}” was created, ${changed.length} ${changed.length === 1 ? "detail has" : "details have"} changed in the CRM. Would you like to update the document before signing, so it shows the latest information?`
      : upToDate
        ? `“${documentName}” already matches the customer's current details.`
        : tracked
          ? `${changed.length} ${changed.length === 1 ? "detail has" : "details have"} changed in the CRM since “${documentName}” was created.`
          : `“${documentName}” was created before the CRM tracked changes, so it can't show what's different. You can still update it with the customer's current details.`;

  return (
    <Dialog open={open} onOpenChange={(next) => !pending && onOpenChange(next)}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        {changed.length > 0 && (
          <div className="max-h-64 space-y-1.5 overflow-y-auto rounded-md border bg-muted/30 p-3">
            <p className="text-xs font-medium text-muted-foreground">Updated details</p>
            {changed.map((c) => (
              <div key={c.token} className="flex items-baseline justify-between gap-3 text-sm">
                <code className="shrink-0 text-xs text-muted-foreground">{c.token}</code>
                <span className="min-w-0 truncate text-right font-medium" title={c.value ?? undefined}>
                  {c.value ?? <span className="font-normal italic text-muted-foreground">now blank</span>}
                </span>
              </div>
            ))}
          </div>
        )}

        {!upToDate && (
          <p className="text-xs text-muted-foreground">
            Anything already signed, and anything the signer changed themselves, stays as it is.
          </p>
        )}
        {(changes?.warnings ?? []).map((w) => (
          <p key={w} className="text-xs text-amber-700 dark:text-amber-400">
            {w}
          </p>
        ))}

        <DialogFooter>
          {upToDate ? (
            <Button onClick={() => onOpenChange(false)}>Close</Button>
          ) : (
            <>
              <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={pending}>
                Cancel
              </Button>
              {mode === "resume" && onContinue && (
                <Button variant="outline" onClick={onContinue} disabled={pending}>
                  Continue without updating
                </Button>
              )}
              <Button onClick={onUpdate} disabled={pending} className="gap-1.5">
                {pending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                {mode === "resume" ? "Update & continue" : "Update document"}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
