"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { useCan } from "@/components/permissions-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  ChevronLeft,
  ChevronRight,
  Folder,
  Images,
  Loader2,
  Trash2,
  Upload,
  X,
} from "lucide-react";

const CHUNK_SIZE = 5 * 1024 * 1024; // 5 MB parts
const IMAGE_RE = /\.(jpe?g|png|gif|webp)$/i;

// Folders mirror the legacy Sunbelt app's categories (exact keys, so legacy-migrated
// photos under {memberId}/{folder}/ line up). Display labels are friendlier.
const LEGACY_FOLDERS: { key: string; label: string }[] = [
  { key: "ColdVault", label: "ColdVault" },
  { key: "DrPepper_BigRed", label: "Dr. Pepper & Big Red" },
  { key: "Monster", label: "Monster" },
  { key: "Redbull", label: "Redbull" },
  { key: "SharedCooler", label: "Shared Cooler" },
  { key: "Other", label: "Other" },
];

// Tolerate PascalCase/camelCase and raw-string responses from the file worker.
function pick(obj: unknown, ...keys: string[]): string | undefined {
  if (typeof obj === "string") return obj;
  if (obj && typeof obj === "object") {
    for (const k of keys) {
      const v = (obj as Record<string, unknown>)[k];
      if (typeof v === "string") return v;
    }
  }
  return undefined;
}

async function readJson(res: Response): Promise<unknown> {
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

function friendlyName(original: string): string {
  const now = new Date();
  const date = now.toLocaleDateString("en-CA").replaceAll("/", "-");
  const time = now.toLocaleTimeString("en-US", { hour12: false }).replaceAll(":", "-");
  const rand = Math.random().toString(36).slice(2, 8).toUpperCase();
  const safe = original.replace(/[^\w.\-]/g, "_");
  return `${date}_${time}-${rand}-${safe}`;
}

// Object keys may carry a storage prefix before the member code (e.g.
// "storage/dev/MA102/ColdVault/file.jpg"), so anchor on the member code like the
// legacy explorer did (indexOf(memberCode + "/")). The folder is the first segment
// after the member code; a file directly under the member buckets into "Other".
function folderOf(key: string, memberId: string): string {
  const marker = `${memberId}/`;
  const idx = key.indexOf(marker);
  const rel = idx >= 0 ? key.slice(idx + marker.length) : key;
  const segs = rel.split("/").filter(Boolean);
  return segs.length > 1 ? segs[0] : "Other";
}
function fileNameOf(key: string): string {
  return key.split("/").pop() ?? key;
}

// Make a user-typed folder name safe to use as a single path segment.
function sanitizeFolder(s: string): string {
  return s
    .trim()
    .replace(/[\\/]+/g, "-") // no nested segments from a single name
    .replace(/\s+/g, " ")
    .replace(/[^\w\- ]/g, "")
    .trim();
}

const NEW_FOLDER = "__new__";
const selectClass =
  "h-9 rounded-md border border-input bg-transparent px-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50";

// Run async tasks with bounded concurrency (avoids storming the BFF/worker with
// dozens of simultaneous presign requests).
async function mapLimit<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const out = new Array<R>(items.length);
  let cursor = 0;
  async function worker() {
    while (cursor < items.length) {
      const i = cursor++;
      out[i] = await fn(items[i]);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return out;
}

export function CustomerPhotos({ memberId }: { memberId: string }) {
  const canUpload = useCan("customer_data:create");
  const canDelete = useCan("customer_data:delete");

  const [keys, setKeys] = useState<string[]>([]); // all image keys for this customer
  const [urls, setUrls] = useState<Record<string, string>>({}); // key -> presigned URL
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [selected, setSelected] = useState<string>(""); // chosen folder; "" → auto-pick
  const [uploadFolder, setUploadFolder] = useState<string>(""); // "" → follow active folder
  const [newFolderName, setNewFolderName] = useState("");
  const [lightbox, setLightbox] = useState<number | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // One list call; folders + counts are derived from the key prefixes client-side.
  const loadIndex = useCallback(async () => {
    try {
      const res = await fetch(`/api/files/List?filePath=${encodeURIComponent(memberId)}`, {
        cache: "no-store",
      });
      const body = res.ok ? await readJson(res) : [];
      const imgKeys = (Array.isArray(body) ? body : []).filter(
        (p): p is string => typeof p === "string" && IMAGE_RE.test(p)
      );
      // Names are timestamp-prefixed, so a descending sort is newest-first.
      imgKeys.sort((a, b) => (a < b ? 1 : a > b ? -1 : 0));
      setKeys(imgKeys);
    } catch {
      setKeys([]);
    } finally {
      setLoading(false);
    }
  }, [memberId]);

  useEffect(() => {
    // loadIndex only setState()s after awaits, not synchronously.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadIndex();
  }, [loadIndex]);

  const grouped = useMemo(() => {
    const m: Record<string, string[]> = {};
    for (const k of keys) (m[folderOf(k, memberId)] ??= []).push(k);
    return m;
  }, [keys, memberId]);

  // Fixed legacy folders, plus any extra folder discovered in storage (never hide data).
  const folders = useMemo(() => {
    const list = [...LEGACY_FOLDERS];
    const known = new Set(LEGACY_FOLDERS.map((f) => f.key));
    for (const k of Object.keys(grouped)) if (!known.has(k)) list.push({ key: k, label: k });
    return list;
  }, [grouped]);

  // Folders-first, like the legacy explorer: no "All photos" flatten. Land on the first
  // folder that has photos (else the first folder); the user switches folders to browse.
  const firstWithPhotos = useMemo(
    () => folders.find((f) => (grouped[f.key]?.length ?? 0) > 0)?.key,
    [folders, grouped]
  );
  const activeFolder = selected || firstWithPhotos || folders[0]?.key || "";
  const visibleKeys = useMemo(() => grouped[activeFolder] ?? [], [grouped, activeFolder]);

  // Upload target: an existing folder, or a new custom folder name the user types.
  const customFolder = sanitizeFolder(newFolderName);
  const targetFolder = uploadFolder === NEW_FOLDER ? customFolder : uploadFolder || activeFolder;

  // Resolve presigned URLs lazily for whatever folder is in view.
  const visibleKey = visibleKeys.join("|");
  useEffect(() => {
    let active = true;
    const missing = visibleKeys.filter((k) => !urls[k]);
    if (missing.length === 0) return;
    (async () => {
      // Bounded concurrency so a large folder doesn't fire dozens of presign calls at
      // once (which floods the BFF token mint and yields 401s).
      const entries = await mapLimit(missing, 5, async (key) => {
        try {
          const r = await fetch(`/api/files/PreSignedUrl?filePath=${encodeURIComponent(key)}`);
          const url = pick(await readJson(r), "url", "Url");
          return url ? ([key, url] as const) : null;
        } catch {
          return null;
        }
      });
      if (!active) return;
      setUrls((prev) => {
        const next = { ...prev };
        for (const e of entries) if (e) next[e[0]] = e[1];
        return next;
      });
    })();
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visibleKey]);

  // Lightbox keyboard navigation (←/→ to move, Esc to close).
  useEffect(() => {
    if (lightbox === null) return;
    function onKey(e: KeyboardEvent) {
      const n = visibleKeys.length;
      if (e.key === "Escape") setLightbox(null);
      else if (e.key === "ArrowRight") setLightbox((i) => (i === null ? i : (i + 1) % n));
      else if (e.key === "ArrowLeft") setLightbox((i) => (i === null ? i : (i - 1 + n) % n));
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [lightbox, visibleKeys.length]);

  async function uploadOne(file: File, folder: string) {
    const contentType = file.type || "application/octet-stream";
    let filePath = `${memberId}/${folder}/${friendlyName(file.name)}`;

    const initRes = await fetch("/api/files/Multipart/Initiate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ filePath, contentType }),
    });
    if (!initRes.ok) throw new Error(await initRes.text());
    const init = await readJson(initRes);
    const uploadId = pick(init, "uploadId", "UploadId");
    filePath = pick(init, "filePath", "FilePath") ?? filePath;
    if (!uploadId) throw new Error("No upload id");

    const totalParts = Math.max(1, Math.ceil(file.size / CHUNK_SIZE));
    // Faster variant: fetch each part's presigned URL and PUT the chunk in parallel.
    const parts = await Promise.all(
      Array.from({ length: totalParts }, (_, i) => i + 1).map(async (partNumber) => {
        const urlRes = await fetch(
          `/api/files/Multipart/GetUrl?filePath=${encodeURIComponent(filePath)}&uploadId=${encodeURIComponent(uploadId)}&partNumber=${partNumber}`
        );
        if (!urlRes.ok) throw new Error("Failed to get part URL");
        const presigned = pick(await readJson(urlRes), "url", "Url");
        if (!presigned) throw new Error("No part URL");

        const start = (partNumber - 1) * CHUNK_SIZE;
        const chunk = file.slice(start, Math.min(start + CHUNK_SIZE, file.size));
        const put = await fetch(presigned, {
          method: "PUT",
          headers: { "Content-Type": contentType },
          body: chunk,
        });
        if (!put.ok) throw new Error("S3 PUT failed");
        const eTag = put.headers.get("ETag")?.replaceAll('"', "");
        return { PartNumber: partNumber, ETag: eTag };
      })
    );

    const completeRes = await fetch(
      `/api/files/Multipart/Complete?filePath=${encodeURIComponent(filePath)}&uploadId=${encodeURIComponent(uploadId)}`,
      { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(parts) }
    );
    if (!completeRes.ok) throw new Error(await completeRes.text());
  }

  async function onFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    const folder = targetFolder;
    if (!folder) {
      toast.error("Pick a folder or enter a new folder name.");
      if (inputRef.current) inputRef.current.value = "";
      return;
    }
    setUploading(true);
    let ok = 0;
    for (const file of Array.from(files)) {
      try {
        await uploadOne(file, folder);
        ok++;
      } catch {
        toast.error(`Upload failed: ${file.name}`);
      }
    }
    setUploading(false);
    if (inputRef.current) inputRef.current.value = "";
    if (ok > 0) {
      toast.success(`Uploaded ${ok} photo${ok > 1 ? "s" : ""} to ${folder}.`);
      setSelected(folder); // jump to the folder we just filled (new folders appear here)
      setUploadFolder("");
      setNewFolderName("");
      void loadIndex();
    }
  }

  async function onDelete(key: string) {
    const res = await fetch(`/api/files/Delete?filePath=${encodeURIComponent(key)}`, {
      method: "DELETE",
    }).catch(() => null);
    if (res?.ok) {
      toast.success("Photo deleted.");
      setKeys((prev) => prev.filter((k) => k !== key));
      setLightbox(null);
    } else {
      toast.error("Failed to delete photo.");
    }
  }

  function folderLabel(key: string): string {
    return folders.find((f) => f.key === key)?.label ?? key;
  }

  const selectedLabel = activeFolder ? folderLabel(activeFolder) : "—";

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-lg font-semibold">
          <Images className="size-5" /> Photos
        </h2>
        {canUpload && (
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm text-muted-foreground">Upload to</span>
            <select
              value={uploadFolder || activeFolder}
              onChange={(e) => setUploadFolder(e.target.value)}
              disabled={uploading}
              aria-label="Upload to folder"
              className={selectClass}
            >
              {folders.map((f) => (
                <option key={f.key} value={f.key}>
                  {f.label}
                </option>
              ))}
              <option value={NEW_FOLDER}>+ New folder…</option>
            </select>
            {uploadFolder === NEW_FOLDER && (
              <Input
                value={newFolderName}
                onChange={(e) => setNewFolderName(e.target.value)}
                placeholder="New folder name"
                disabled={uploading}
                className="h-9 w-44"
              />
            )}
            <input
              ref={inputRef}
              type="file"
              accept="image/*"
              multiple
              hidden
              onChange={(e) => onFiles(e.target.files)}
            />
            <Button
              onClick={() => inputRef.current?.click()}
              disabled={uploading || (uploadFolder === NEW_FOLDER && !customFolder)}
            >
              {uploading ? <Loader2 className="animate-spin" /> : <Upload />}
              Upload
            </Button>
          </div>
        )}
      </div>

      {loading ? (
        <div className="flex h-24 items-center justify-center text-sm text-muted-foreground">
          <Loader2 className="mr-2 animate-spin" /> Loading photos…
        </div>
      ) : (
        <div className="gap-4 md:grid md:grid-cols-[210px_minmax(0,1fr)]">
          {/* LEFT: folders */}
          <nav className="mb-3 flex gap-1 overflow-x-auto md:mb-0 md:flex-col md:overflow-visible">
            {folders.map((f) => (
              <FolderButton
                key={f.key}
                label={f.label}
                count={grouped[f.key]?.length ?? 0}
                active={activeFolder === f.key}
                onClick={() => {
                  setSelected(f.key);
                  setLightbox(null);
                }}
              />
            ))}
          </nav>

          {/* RIGHT: images for the selected folder */}
          <div className="min-w-0">
            <div className="mb-2 text-sm text-muted-foreground">
              {selectedLabel} · {visibleKeys.length} photo{visibleKeys.length === 1 ? "" : "s"}
            </div>
            {visibleKeys.length === 0 ? (
              <div className="rounded-md border border-dashed p-8 text-center text-sm text-muted-foreground">
                No photos in {selectedLabel} for {memberId}.
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                {visibleKeys.map((key, i) => (
                  <div key={key} className="group relative overflow-hidden rounded-md border bg-muted/30">
                    {urls[key] ? (
                      <>
                        {/* Worker-presigned S3 URLs are remote + short-lived; use a plain img. */}
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={urls[key]}
                          alt={fileNameOf(key)}
                          className="aspect-square w-full cursor-pointer object-cover"
                          onClick={() => setLightbox(i)}
                        />
                        {canDelete && (
                          <button
                            type="button"
                            onClick={() => onDelete(key)}
                            aria-label="Delete photo"
                            className="absolute right-1 top-1 rounded-md bg-black/60 p-1 text-white opacity-0 transition-opacity hover:bg-black/80 group-hover:opacity-100"
                          >
                            <Trash2 className="size-4" />
                          </button>
                        )}
                      </>
                    ) : (
                      <div className="flex aspect-square w-full items-center justify-center">
                        <Loader2 className="size-5 animate-spin text-muted-foreground" />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Lightbox with prev/next navigation */}
      {lightbox !== null && visibleKeys[lightbox] && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4"
          onClick={() => setLightbox(null)}
        >
          <button
            type="button"
            aria-label="Close"
            className="absolute right-4 top-4 rounded-md bg-white/10 p-2 text-white hover:bg-white/20"
            onClick={() => setLightbox(null)}
          >
            <X />
          </button>

          {visibleKeys.length > 1 && (
            <button
              type="button"
              aria-label="Previous photo"
              className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full bg-white/10 p-3 text-white hover:bg-white/20 sm:left-6"
              onClick={(e) => {
                e.stopPropagation();
                setLightbox((i) => (i === null ? i : (i - 1 + visibleKeys.length) % visibleKeys.length));
              }}
            >
              <ChevronLeft />
            </button>
          )}

          <figure className="flex max-h-full max-w-full flex-col items-center gap-2" onClick={(e) => e.stopPropagation()}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={urls[visibleKeys[lightbox]]}
              alt={fileNameOf(visibleKeys[lightbox])}
              className="max-h-[80vh] max-w-full rounded-md object-contain"
            />
            <figcaption className="max-w-full truncate text-xs text-white/70">
              {fileNameOf(visibleKeys[lightbox])} · {lightbox + 1}/{visibleKeys.length}
            </figcaption>
          </figure>

          {visibleKeys.length > 1 && (
            <button
              type="button"
              aria-label="Next photo"
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-white/10 p-3 text-white hover:bg-white/20 sm:right-6"
              onClick={(e) => {
                e.stopPropagation();
                setLightbox((i) => (i === null ? i : (i + 1) % visibleKeys.length));
              }}
            >
              <ChevronRight />
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function FolderButton({
  label,
  count,
  active,
  onClick,
}: {
  label: string;
  count: number;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex shrink-0 items-center gap-2 whitespace-nowrap rounded-md px-3 py-2 text-left text-sm transition-colors md:w-full ${
        active ? "bg-brand/10 font-medium text-brand" : "hover:bg-muted"
      }`}
    >
      <Folder className="size-4 shrink-0" />
      <span className="min-w-0 flex-1 truncate">{label}</span>
      <span className={`text-xs ${active ? "text-brand" : "text-muted-foreground"}`}>{count}</span>
    </button>
  );
}
