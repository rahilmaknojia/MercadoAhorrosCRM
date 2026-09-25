"use client";

import { useEffect, useState } from "react";
import { ArrowRight, GitCompare, Loader2 } from "lucide-react";
import { getComplianceReviewVersion } from "@/app/(app)/customers/[id]/compliance-actions";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  answersOf,
  diffReviews,
  formatReviewDate,
  quarterLabel,
  roundLabel,
  type ComplianceReview,
} from "@/lib/compliance";
import { IssueChips } from "./issue-chips";
import { ReviewForm } from "./review-form";
import { SignatureBlock } from "./signature-block";
import { StatusPill } from "./status-pill";

/**
 * One version, read-only, with what changed since the version before it
 * ("Pepsi gondola space: No → Yes").
 */
export function VersionDialog({
  customerId,
  version,
  previousVersion,
  onClose,
}: {
  customerId: number;
  version: number | null;
  /** The next-older version, to diff against; null for the first. */
  previousVersion: number | null;
  onClose: () => void;
}) {
  return (
    <Dialog open={version !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-3xl">
        {version !== null && (
          <VersionBody key={version} customerId={customerId} version={version} previousVersion={previousVersion} />
        )}
      </DialogContent>
    </Dialog>
  );
}

type Loaded = { review: ComplianceReview; previous: ComplianceReview | null } | { error: string } | null;

function VersionBody({
  customerId,
  version,
  previousVersion,
}: {
  customerId: number;
  version: number;
  previousVersion: number | null;
}) {
  const [loaded, setLoaded] = useState<Loaded>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      // Server actions are dispatched one at a time anyway, so load sequentially.
      const res = await getComplianceReviewVersion(customerId, version);
      const prev = res.ok && previousVersion ? await getComplianceReviewVersion(customerId, previousVersion) : null;
      if (cancelled) return;
      if (!res.ok) setLoaded({ error: res.error });
      else setLoaded({ review: res.data, previous: prev?.ok ? prev.data : null });
    })();
    return () => {
      cancelled = true;
    };
  }, [customerId, version, previousVersion]);

  if (!loaded) {
    return (
      <>
        <DialogHeader>
          <DialogTitle>Version {version}</DialogTitle>
        </DialogHeader>
        <div className="flex items-center justify-center gap-2 py-12 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" /> Loading…
        </div>
      </>
    );
  }
  if ("error" in loaded) {
    return (
      <>
        <DialogHeader>
          <DialogTitle>Version {version}</DialogTitle>
        </DialogHeader>
        <p className="rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">{loaded.error}</p>
      </>
    );
  }

  const { review, previous } = loaded;
  const answers = answersOf(review);
  const changes = previous ? diffReviews(answersOf(previous), answers) : null;
  const issues = Object.keys(review.issues ?? {});

  return (
    <>
      <DialogHeader>
        <DialogTitle className="flex flex-wrap items-center gap-2">
          Compliance review
          <StatusPill status={review.status} version={review.version} />
          {review.source === "legacy" && (
            <span className="rounded-full border px-1.5 py-0.5 text-[11px] font-normal text-muted-foreground">Legacy</span>
          )}
        </DialogTitle>
        <DialogDescription>
          {[
            [quarterLabel(review.quarter), review.year].filter(Boolean).join(" "),
            roundLabel(review.review),
            review.status === "submitted" && review.submitted_on && `Submitted ${formatReviewDate(review.submitted_on, true)}`,
          ]
            .filter(Boolean)
            .join(" · ")}
        </DialogDescription>
      </DialogHeader>

      <IssueChips issues={issues} showNone />

      {previous && changes && (
        <section className="space-y-2 rounded-xl border bg-muted/30 p-3">
          <h3 className="flex items-center gap-2 text-sm font-medium">
            <GitCompare className="size-4 text-muted-foreground" />
            Changes from v{previous.version}
            <span className="font-normal text-muted-foreground">
              ({changes.length === 0 ? "none" : changes.length})
            </span>
          </h3>
          {changes.length > 0 && (
            <ul className="max-h-60 space-y-1 overflow-y-auto text-sm">
              {changes.map((c) => (
                <li key={c.label} className="flex flex-wrap items-baseline gap-x-2">
                  <span className="font-medium">{c.label}:</span>
                  <span className="text-muted-foreground line-through decoration-muted-foreground/50">{c.from}</span>
                  <ArrowRight className="size-3 self-center text-muted-foreground" />
                  <span className="font-medium">{c.to}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      <ReviewForm answers={answers} readOnly sectionsOpen={false} />

      {review.status === "submitted" && <SignatureBlock customerId={customerId} review={review} />}
    </>
  );
}
