"use client";

import { useState } from "react";
import { AlertCircle, Loader2, Send } from "lucide-react";
import { SignaturePad } from "@/components/signature-pad";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  computeIssues,
  missingRequired,
  overallProgress,
  quarterLabel,
  roundLabel,
  type ComplianceAnswers,
} from "@/lib/compliance";
import { IssueChips } from "./issue-chips";

/**
 * Submit: a last look at what the review found, the required-field check, and the rep's
 * signature. The signature is captured here (not saved on file) and sent with the submit.
 * The dialog body unmounts on close, so every opening starts with a blank pad.
 */
export function SubmitDialog({
  open,
  onOpenChange,
  answers,
  version,
  submitting,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  answers: ComplianceAnswers;
  version: number | null;
  submitting: boolean;
  onSubmit: (signature: string) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={(o) => !submitting && onOpenChange(o)}>
      <DialogContent className="sm:max-w-xl">
        {open && (
          <SubmitBody answers={answers} version={version} submitting={submitting} onSubmit={onSubmit} onCancel={() => onOpenChange(false)} />
        )}
      </DialogContent>
    </Dialog>
  );
}

function SubmitBody({
  answers,
  version,
  submitting,
  onSubmit,
  onCancel,
}: {
  answers: ComplianceAnswers;
  version: number | null;
  submitting: boolean;
  onSubmit: (signature: string) => void;
  onCancel: () => void;
}) {
  const [signature, setSignature] = useState<string | null>(null);
  const missing = missingRequired(answers);
  const issues = computeIssues(answers);
  const { answered, total } = overallProgress(answers);
  const unanswered = total - answered;
  const period = [quarterLabel(answers.quarter), answers.year].filter(Boolean).join(" ");

  return (
    <>
      <DialogHeader>
        <DialogTitle>Submit compliance review{version ? ` v${version}` : ""}</DialogTitle>
        <DialogDescription>
          {[period, roundLabel(answers.review)].filter(Boolean).join(" · ") || "Check the details, then sign."}
        </DialogDescription>
      </DialogHeader>

      {missing.length > 0 && (
        <div className="flex gap-2 rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
          <AlertCircle className="mt-0.5 size-4 shrink-0" />
          <p>
            Fill in <strong>{missing.join(", ")}</strong> before submitting.
          </p>
        </div>
      )}

      <section className="space-y-2">
        <h3 className="text-sm font-medium">Issues found</h3>
        <IssueChips issues={issues} showNone />
      </section>

      <section className="space-y-1">
        <h3 className="text-sm font-medium">Answers</h3>
        <p className="text-sm text-muted-foreground">
          {answered} of {total} questions answered
          {unanswered > 0 && ` — ${unanswered} will be saved as not answered`}.
        </p>
      </section>

      <section className="space-y-2">
        <h3 className="text-sm font-medium">Rep signature</h3>
        <SignaturePad onChange={setSignature} saving={submitting} />
      </section>

      <DialogFooter>
        <Button variant="ghost" onClick={onCancel} disabled={submitting}>
          Cancel
        </Button>
        <Button
          onClick={() => signature && onSubmit(signature)}
          disabled={submitting || missing.length > 0 || !signature}
        >
          {submitting ? <Loader2 className="animate-spin" /> : <Send />}
          Sign &amp; submit
        </Button>
      </DialogFooter>
    </>
  );
}
