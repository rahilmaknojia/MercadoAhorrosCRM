"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * A copy-to-clipboard icon button. Shows a check for ~1.5s after a successful copy.
 * Kept visually quiet (muted, small) so it can sit inline next to a value.
 */
export function CopyButton({
  value,
  label,
  className,
}: {
  value: string;
  label?: string;
  className?: string;
}) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard blocked (insecure context / permissions) — nothing useful to do.
    }
  }

  return (
    <button
      type="button"
      onClick={copy}
      aria-label={copied ? "Copied" : `Copy ${label ?? "value"}`}
      className={cn(
        "inline-flex shrink-0 items-center text-muted-foreground transition-colors hover:text-foreground",
        className
      )}
    >
      {copied ? <Check className="size-3.5 text-green-600" /> : <Copy className="size-3.5" />}
    </button>
  );
}

/**
 * A labelled value row with a copy button that fades in on hover (or keyboard focus).
 * Hidden entirely when there is no value, matching the plain Field used elsewhere on the page.
 */
export function CopyField({
  label,
  value,
}: {
  label: string;
  value?: string | null;
}) {
  if (!value) return null;
  return (
    <div className="group flex items-center justify-between gap-4 py-1 text-sm">
      <span className="text-muted-foreground">{label}</span>
      {/* Icon sits left of the value so the value's right edge aligns with the plain (non-copy)
          rows; the reserved icon width no longer pushes the text inward. */}
      <span className="flex min-w-0 items-center gap-1.5">
        <CopyButton
          value={value}
          label={label.toLowerCase()}
          className="opacity-0 focus-visible:opacity-100 group-hover:opacity-100"
        />
        <span className="truncate text-right font-medium">{value}</span>
      </span>
    </div>
  );
}
