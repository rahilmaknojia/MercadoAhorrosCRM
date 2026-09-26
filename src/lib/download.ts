"use client";

import { useCallback, useState } from "react";
import { toast } from "sonner";

// Filename from a Content-Disposition header (RFC 5987 filename* first, then filename).
function filenameFrom(disposition: string | null): string | null {
  if (!disposition) return null;
  const star = /filename\*\s*=\s*(?:UTF-8'')?([^;]+)/i.exec(disposition);
  if (star) {
    try {
      return decodeURIComponent(star[1].trim().replace(/^"|"$/g, ""));
    } catch {
      // fall through to the plain filename
    }
  }
  const plain = /filename\s*=\s*"?([^";]+)"?/i.exec(disposition);
  return plain ? plain[1].trim() : null;
}

/**
 * Fetch a file in the background and hand it to the browser as a download. Unlike a plain link
 * (where the only feedback is the tab spinner) the caller knows the request is in flight, so the
 * UI can say so while a slow upstream (e.g. NinjaFlow sealing a PDF) prepares the file.
 * Throws with the route's `error` message on failure.
 */
export async function downloadFile(url: string, fallbackName: string): Promise<void> {
  const res = await fetch(url);
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { error?: string } | null;
    throw new Error(body?.error ?? `Download failed (${res.status}).`);
  }
  const blob = await res.blob();
  const href = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = href;
  a.download = filenameFrom(res.headers.get("content-disposition")) ?? fallbackName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  // Revoking synchronously can cancel the download in some browsers; give it a moment.
  setTimeout(() => URL.revokeObjectURL(href), 10_000);
}

/** `downloadFile` with an in-flight flag for a busy button, and a toast on failure. */
export function useFileDownload() {
  const [downloading, setDownloading] = useState(false);
  const download = useCallback(async (url: string, fallbackName: string) => {
    setDownloading(true);
    try {
      await downloadFile(url, fallbackName);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Download failed.");
    } finally {
      setDownloading(false);
    }
  }, []);
  return { downloading, download };
}
