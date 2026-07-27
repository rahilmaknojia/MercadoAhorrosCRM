"use client";

import { useEffect, useRef, useState } from "react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Download, Loader2, Minus, Plus, X } from "lucide-react";

const MIN_SCALE = 0.5;
const MAX_SCALE = 3;
const SCALE_STEP = 0.2;

/**
 * In-app PDF viewer: fetches the document (same-origin BFF route, cookies attached) and renders
 * each page to a canvas with pdf.js — no reliance on the browser's built-in PDF viewer. Supports
 * zoom and an export that can exclude pages. pdf.js is imported lazily (never during SSR) and its
 * worker is served as a static asset from /public.
 */
export function PdfViewerModal({
  basePath,
  title = "Signed document",
  onClose,
}: {
  basePath: string;
  title?: string;
  onClose: () => void;
}) {
  const pagesRef = useRef<HTMLDivElement>(null);
  const pdfRef = useRef<import("pdfjs-dist").PDFDocumentProxy | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [scale, setScale] = useState(1.2);
  const [skip, setSkip] = useState("");

  // Load the document once.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const pdfjs = await import("pdfjs-dist");
        pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
        const res = await fetch(basePath);
        if (!res.ok) throw new Error("fetch failed");
        const data = await res.arrayBuffer();
        if (cancelled) return;
        pdfRef.current = await pdfjs.getDocument({ data }).promise;
        if (!cancelled) setStatus("ready");
      } catch {
        if (!cancelled) setStatus("error");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [basePath]);

  // (Re)render all pages whenever the document is ready or the zoom changes.
  useEffect(() => {
    if (status !== "ready") return;
    let cancelled = false;
    (async () => {
      const pdf = pdfRef.current;
      const container = pagesRef.current;
      if (!pdf || !container) return;
      container.replaceChildren();
      for (let n = 1; n <= pdf.numPages; n++) {
        const page = await pdf.getPage(n);
        if (cancelled) return;
        const viewport = page.getViewport({ scale });
        const canvas = document.createElement("canvas");
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        canvas.className = "mx-auto mb-4 rounded bg-white shadow";
        const ctx = canvas.getContext("2d");
        if (!ctx) continue;
        container.appendChild(canvas);
        await page.render({ canvasContext: ctx, viewport }).promise;
        if (cancelled) return;
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [scale, status]);

  const zoom = (delta: number) =>
    setScale((s) => Math.min(MAX_SCALE, Math.max(MIN_SCALE, Math.round((s + delta) * 10) / 10)));

  const exportHref = `${basePath}?download=true${
    skip.trim() ? `&skip=${encodeURIComponent(skip.trim())}` : ""
  }`;

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col bg-black/70"
      role="dialog"
      aria-modal="true"
      onClick={onClose}
    >
      <div
        className="mx-auto flex h-full w-full max-w-4xl flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="border-b bg-background">
          <div className="flex items-center justify-between px-4 py-2">
            <span className="truncate text-sm font-medium">{title}</span>
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="sm" onClick={() => zoom(-SCALE_STEP)} disabled={scale <= MIN_SCALE} title="Zoom out">
                <Minus className="h-4 w-4" />
              </Button>
              <span className="w-12 text-center text-xs tabular-nums text-muted-foreground">
                {Math.round(scale * 100)}%
              </span>
              <Button variant="ghost" size="sm" onClick={() => zoom(SCALE_STEP)} disabled={scale >= MAX_SCALE} title="Zoom in">
                <Plus className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="sm" onClick={onClose} className="gap-1.5">
                <X className="h-4 w-4" />
                Close
              </Button>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2 border-t px-4 py-2">
            <span className="text-xs text-muted-foreground">Export</span>
            <Input
              className="h-8 w-44"
              placeholder="Pages to skip (e.g. 2,5)"
              value={skip}
              onChange={(e) => setSkip(e.target.value)}
            />
            <a href={exportHref} className={buttonVariants({ variant: "outline", size: "sm" })}>
              <Download className="h-3.5 w-3.5" />
              Download
            </a>
          </div>
        </div>

        <div className="flex-1 overflow-auto bg-muted p-4">
          {status === "loading" && (
            <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading document…
            </div>
          )}
          {status === "error" && (
            <div className="py-10 text-center text-sm text-destructive">
              Could not load the document.
            </div>
          )}
          <div ref={pagesRef} />
        </div>
      </div>
    </div>
  );
}
