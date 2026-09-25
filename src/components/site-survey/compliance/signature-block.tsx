"use client";

/* eslint-disable @next/next/no-img-element */
import { useState } from "react";
import { formatReviewDate, type ComplianceReview } from "@/lib/compliance";

/**
 * The rep's signature (streamed through the BFF route so a plain <img> can carry the session)
 * and who submitted the review, when.
 */
export function SignatureBlock({ customerId, review }: { customerId: number; review: ComplianceReview }) {
  const [failed, setFailed] = useState(false);
  const signedBy = review.rep_signature?.signed_by || review.submitted_by;
  const signedOn = review.rep_signature?.signed_on || review.submitted_on;

  return (
    <div className="flex flex-wrap items-end gap-4 rounded-xl border bg-muted/20 p-3">
      {review.rep_signature && !failed ? (
        <div className="rounded-md border bg-white p-2">
          <img
            src={`/api/customers/${customerId}/compliance-review/versions/${review.version}/signature`}
            alt={`Signature of ${signedBy ?? "the rep"}`}
            className="h-20 w-auto max-w-full"
            onError={() => setFailed(true)}
          />
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">
          {review.rep_signature ? "The signature could not be loaded." : "No signature on file."}
        </p>
      )}
      <div className="text-sm">
        <p className="text-xs text-muted-foreground">Submitted by</p>
        <p className="font-medium">{signedBy || "Unknown"}</p>
        {signedOn && <p className="text-xs text-muted-foreground">{formatReviewDate(signedOn, true)}</p>}
      </div>
    </div>
  );
}
