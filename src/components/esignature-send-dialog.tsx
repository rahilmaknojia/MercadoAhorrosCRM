"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { AlertTriangle, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { isComplianceToken, parseTemplateMapping, reviewRefLabel } from "@/lib/esign-survey";
import type { ComplianceReviewRef, EsignaturePreview, EsignatureTemplate } from "@/lib/types";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const selectClass =
  "h-9 rounded-md border border-input bg-transparent px-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50";

const PREVIEW_DEBOUNCE_MS = 250;

type PreviewResult = { key: string; data?: EsignaturePreview; error?: string };

/**
 * Loads the merge preview for (template, pinned version). Debounced, and every superseded request
 * is aborted, so only the latest selection's answer is ever shown. `loading` is derived (the last
 * result belongs to a different request) rather than set synchronously inside the effect.
 */
function useMergePreview(customerId: number, templateId: number, version: number | null) {
  const key = `${templateId}:${version ?? ""}`;
  const [result, setResult] = useState<PreviewResult | null>(null);
  // The unpinned answer: which review the template's own selection picks (the dropdown default).
  const [baseline, setBaseline] = useState<EsignaturePreview | null>(null);

  useEffect(() => {
    const ctrl = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/customers/${customerId}/esignature-preview`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(version === null ? { templateId } : { templateId, complianceReviewVersion: version }),
          signal: ctrl.signal,
        });
        const body = (await res.json().catch(() => null)) as (EsignaturePreview & { message?: string }) | null;
        if (ctrl.signal.aborted) return;
        if (!res.ok || !body) {
          setResult({ key, error: body?.message ?? "Could not load the preview." });
          return;
        }
        const data: EsignaturePreview = {
          mergeData: body.mergeData ?? [],
          complianceReview: body.complianceReview ?? null,
          submittedReviews: body.submittedReviews ?? [],
          warnings: body.warnings ?? [],
        };
        setResult({ key, data });
        if (version === null) setBaseline(data);
      } catch {
        if (!ctrl.signal.aborted) setResult({ key, error: "Could not load the preview." });
      }
    }, PREVIEW_DEBOUNCE_MS);
    return () => {
      clearTimeout(timer);
      ctrl.abort();
    };
  }, [customerId, templateId, version, key]);

  const current = result?.key === key ? result : null;
  return {
    loading: !current,
    error: current?.error ?? null,
    // While a re-preview is in flight keep showing the previous values (dimmed) instead of a blank.
    data: current?.data ?? result?.data ?? null,
    baseline,
  };
}

/**
 * The confirm step for "Send" and "Sign in person": previews what the template will fill for this
 * member, lets the operator pin a submitted compliance review, and hosts any mode-specific
 * content (the in-person signature check) above the footer.
 */
export function EsignatureSendDialog({
  open,
  onOpenChange,
  ...props
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
} & BodyProps) {
  return (
    <Dialog open={open} onOpenChange={(next) => !props.pending && onOpenChange(next)}>
      <DialogContent className="sm:max-w-xl">
        {/* Mounted only while open, so each opening starts unpinned with a fresh preview. */}
        {open && <SendDialogBody {...props} />}
      </DialogContent>
    </Dialog>
  );
}

type BodyProps = {
  customerId: number;
  template: EsignatureTemplate;
  title: string;
  description: string;
  confirmLabel: string;
  confirmIcon: ReactNode;
  pending: boolean;
  /** Extra gating from the host (e.g. a signature being saved). */
  confirmDisabled?: boolean;
  /** `complianceReviewVersion` is set only when the operator changed the review. */
  onConfirm: (complianceReviewVersion: number | null) => void;
  onCancel: () => void;
  children?: ReactNode;
};

function SendDialogBody({
  customerId,
  template,
  title,
  description,
  confirmLabel,
  confirmIcon,
  pending,
  confirmDisabled,
  onConfirm,
  onCancel,
  children,
}: BodyProps) {
  const [pinned, setPinned] = useState<number | null>(null);
  const usesCompliance = useMemo(
    () => parseTemplateMapping(template.mappingJson).mergeTokens.some(isComplianceToken),
    [template.mappingJson]
  );
  const { loading, error, data, baseline } = useMergePreview(customerId, template.id, pinned);

  const submitted = (data ?? baseline)?.submittedReviews ?? [];
  const defaultRef = baseline?.complianceReview ?? null;
  const defaultIsSubmitted = !!defaultRef && submitted.some((r) => r.version === defaultRef.version);

  function pickReview(value: string) {
    const n = value ? Number(value) : null;
    // Picking the default again un-pins, so the request carries no complianceReviewVersion.
    setPinned(n !== null && !(defaultIsSubmitted && n === defaultRef!.version) ? n : null);
  }

  const filled = data?.mergeData.filter((m) => m.value != null && m.value !== "").length ?? 0;

  return (
    <>
      <DialogHeader>
        <DialogTitle>{title}</DialogTitle>
        <DialogDescription>{description}</DialogDescription>
      </DialogHeader>

      {usesCompliance && baseline && (
        <ComplianceReviewPick
          submitted={submitted}
          defaultRef={defaultRef}
          defaultIsSubmitted={defaultIsSubmitted}
          value={pinned ?? (defaultIsSubmitted ? defaultRef!.version : null)}
          onChange={pickReview}
          disabled={pending}
        />
      )}

      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">Will be filled</span>
          {data && (
            <span className="text-xs text-muted-foreground">
              {filled} of {data.mergeData.length} fields
            </span>
          )}
          {loading && <Loader2 className="ml-auto size-3.5 animate-spin text-muted-foreground" />}
        </div>
        {error ? (
          <p className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive">
            {error} You can still continue — the values are resolved when the document is created.
          </p>
        ) : !data ? (
          <p className="text-xs text-muted-foreground">Loading preview…</p>
        ) : data.mergeData.length === 0 ? (
          <p className="text-xs text-muted-foreground">This template has no mapped merge fields.</p>
        ) : (
          <dl
            className={cn(
              "grid max-h-56 grid-cols-[minmax(0,2fr)_minmax(0,3fr)] gap-x-3 gap-y-1 overflow-y-auto rounded-md border bg-muted/20 p-2 text-xs transition-opacity",
              loading && "opacity-60"
            )}
          >
            {data.mergeData.map((m) => {
              const blank = m.value == null || m.value === "";
              return (
                <div key={m.token} className="contents">
                  <dt className="truncate font-mono text-muted-foreground" title={m.field ?? m.token}>
                    {m.token}
                  </dt>
                  <dd className={cn("break-words", blank && "italic text-muted-foreground/70")}>
                    {blank ? "blank" : m.value}
                  </dd>
                </div>
              );
            })}
          </dl>
        )}
        {data && data.warnings.length > 0 && (
          <ul className="space-y-1 rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-800 dark:text-amber-300">
            {data.warnings.map((w) => (
              <li key={w} className="flex gap-1.5">
                <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
                <span>{w}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {children}

      <DialogFooter>
        <Button variant="ghost" onClick={onCancel} disabled={pending}>
          Cancel
        </Button>
        <Button
          onClick={() => onConfirm(pinned)}
          disabled={pending || confirmDisabled || (loading && !data && !error)}
          className="gap-1.5"
        >
          {pending ? <Loader2 className="size-3.5 animate-spin" /> : confirmIcon}
          {confirmLabel}
        </Button>
      </DialogFooter>
    </>
  );
}

function ComplianceReviewPick({
  submitted,
  defaultRef,
  defaultIsSubmitted,
  value,
  onChange,
  disabled,
}: {
  submitted: ComplianceReviewRef[];
  defaultRef: ComplianceReviewRef | null;
  defaultIsSubmitted: boolean;
  value: number | null;
  onChange: (value: string) => void;
  disabled: boolean;
}) {
  if (submitted.length === 0) {
    return (
      <div className="flex gap-2 rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-800 dark:text-amber-300">
        <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
        <span>
          {/* The consequence ("…they will be blank") comes from the API's warnings below. */}
          {defaultRef
            ? `No submitted compliance review — the compliance fields use ${reviewRefLabel(defaultRef, "draft")}.`
            : "This member has no submitted compliance review."}{" "}
          {/* A full load (not a soft navigation) so the member tabs open on Site Survey → Compliance. */}
          <a href="?tab=survey&sub=compliance" className="font-medium underline underline-offset-2">
            Open Compliance Review
          </a>
        </span>
      </div>
    );
  }

  return (
    <div className="space-y-1">
      <label htmlFor="esign-compliance-version" className="text-sm font-medium">
        Compliance review
      </label>
      <select
        id="esign-compliance-version"
        className={`${selectClass} w-full`}
        value={value === null ? "" : String(value)}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
      >
        {!defaultIsSubmitted && (
          <option value="">
            {defaultRef
              ? `Template default — ${reviewRefLabel(defaultRef, defaultRef.status === "submitted" ? "submitted" : "draft")}`
              : "Template default"}
          </option>
        )}
        {submitted.map((r, i) => (
          <option key={r.version} value={r.version}>
            {reviewRefLabel(r)}
            {i === 0 ? " (most recent)" : ""}
          </option>
        ))}
      </select>
    </div>
  );
}
