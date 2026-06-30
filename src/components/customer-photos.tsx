"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { useCan } from "@/components/permissions-provider";
import { Button } from "@/components/ui/button";
import { Loader2, Trash2, Upload, X } from "lucide-react";

const CHUNK_SIZE = 5 * 1024 * 1024; // 5 MB parts
const CATEGORIES = ["Storefront", "Interior", "Equipment", "Compliance", "Other"];
const IMAGE_RE = /\.(jpe?g|png|gif|webp)$/i;

type Photo = { key: string; url: string };

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

export function CustomerPhotos({ memberId }: { memberId: string }) {
  const canUpload = useCan("customer_data:create");
  const canDelete = useCan("customer_data:delete");

  const [photos, setPhotos] = useState<Photo[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [category, setCategory] = useState(CATEGORIES[0]);
  const [lightbox, setLightbox] = useState<number | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const loadPhotos = useCallback(async () => {
    try {
      const res = await fetch(`/api/files/List?filePath=${encodeURIComponent(memberId)}`, {
        cache: "no-store",
      });
      const body = res.ok ? await readJson(res) : [];
      const keys = (Array.isArray(body) ? body : [])
        .filter((p): p is string => typeof p === "string" && IMAGE_RE.test(p));

      const resolved = await Promise.all(
        keys.map(async (key) => {
          try {
            const r = await fetch(`/api/files/PreSignedUrl?filePath=${encodeURIComponent(key)}`);
            const url = pick(await readJson(r), "url", "Url");
            return url ? { key, url } : null;
          } catch {
            return null;
          }
        })
      );
      setPhotos(resolved.filter((p): p is Photo => p !== null));
    } catch {
      setPhotos([]);
    } finally {
      setLoading(false);
    }
  }, [memberId]);

  useEffect(() => {
    // Load the gallery on mount. loadPhotos only setState()s after awaits, not
    // synchronously, so the cascading-render concern this rule guards doesn't apply.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadPhotos();
  }, [loadPhotos]);

  async function uploadOne(file: File) {
    const contentType = file.type || "application/octet-stream";
    let filePath = `${memberId}/${category}/${friendlyName(file.name)}`;

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
    setUploading(true);
    let ok = 0;
    for (const file of Array.from(files)) {
      try {
        await uploadOne(file);
        ok++;
      } catch {
        toast.error(`Upload failed: ${file.name}`);
      }
    }
    setUploading(false);
    if (inputRef.current) inputRef.current.value = "";
    if (ok > 0) {
      toast.success(`Uploaded ${ok} photo${ok > 1 ? "s" : ""}.`);
      void loadPhotos();
    }
  }

  async function onDelete(key: string) {
    const res = await fetch(`/api/files/Delete?filePath=${encodeURIComponent(key)}`, {
      method: "DELETE",
    }).catch(() => null);
    if (res?.ok) {
      toast.success("Photo deleted.");
      setPhotos((prev) => prev.filter((p) => p.key !== key));
    } else {
      toast.error("Failed to delete photo.");
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-semibold">Photos</h2>
        {canUpload && (
          <div className="flex items-center gap-2">
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              disabled={uploading}
              className="h-9 rounded-md border border-input bg-transparent px-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
            >
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
            <input
              ref={inputRef}
              type="file"
              accept="image/*"
              multiple
              hidden
              onChange={(e) => onFiles(e.target.files)}
            />
            <Button onClick={() => inputRef.current?.click()} disabled={uploading}>
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
      ) : photos.length === 0 ? (
        <div className="rounded-md border border-dashed p-8 text-center text-sm text-muted-foreground">
          No photos yet for {memberId}.
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
          {photos.map((p, i) => (
            <div key={p.key} className="group relative overflow-hidden rounded-md border">
              {/* Worker-presigned S3 URLs are remote + short-lived; use a plain img. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={p.url}
                alt={p.key.split("/").pop() ?? "photo"}
                className="aspect-square w-full cursor-pointer object-cover"
                onClick={() => setLightbox(i)}
              />
              {canDelete && (
                <button
                  type="button"
                  onClick={() => onDelete(p.key)}
                  aria-label="Delete photo"
                  className="absolute right-1 top-1 rounded-md bg-black/60 p-1 text-white opacity-0 transition-opacity hover:bg-black/80 group-hover:opacity-100"
                >
                  <Trash2 className="size-4" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {lightbox !== null && photos[lightbox] && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
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
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={photos[lightbox].url}
            alt={photos[lightbox].key.split("/").pop() ?? "photo"}
            className="max-h-full max-w-full rounded-md object-contain"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  );
}
