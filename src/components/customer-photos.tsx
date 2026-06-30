"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { useCan } from "@/components/permissions-provider";
import { prepareImage } from "@/lib/image-prep";
import { logPhotoActivity, savePhotoCaption } from "@/app/(app)/customers/photo-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Camera,
  Check,
  CheckSquare,
  ChevronLeft,
  ChevronRight,
  Download,
  ExternalLink,
  Folder,
  Images,
  Loader2,
  Maximize2,
  Pause,
  Play,
  RotateCw,
  Trash2,
  Upload,
  X,
  ZoomIn,
  ZoomOut,
} from "lucide-react";

const CHUNK_SIZE = 5 * 1024 * 1024; // 5 MB parts
const IMAGE_RE = /\.(jpe?g|png|gif|webp)$/i;
// NFImageWorker stores size renditions as {originalKey}/w{width}.webp alongside the
// original. This matches a rendition filename and captures its width.
const RENDITION_RE = /^w(\d+)\.(webp|jpe?g|png|gif)$/i;

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

const NEW_FOLDER = "__new__";
// Bump this whenever the gallery logic changes; it's shown next to the Photos heading
// so we can tell at a glance which build is actually deployed. "merge" = the build that
// collapses an original with its size renditions into one tile.
const GALLERY_BUILD = "g10-captions";
const selectClass =
  "h-9 rounded-md border border-input bg-transparent px-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50";

// A source photo: one original plus its size renditions (collapsed from many keys).
type Photo = {
  source: string; // identity (original key, == rendition parent path)
  folder: string;
  name: string; // display filename
  original?: string; // original object key, if present in the listing
  renditions: Record<number, string>; // width -> object key
};

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

function fileNameOf(key: string): string {
  return key.split("/").pop() ?? key;
}

// The worker stores renditions under the original key WITHOUT its extension
// (original "foo.png" -> renditions "foo/w512.webp"). Strip the image extension so an
// original and its rendition group resolve to the same photo identity.
function stripImageExt(key: string): string {
  return key.replace(/\.(jpe?g|png|gif|webp|heic|heif)$/i, "");
}

// Folder identity is case-insensitive (merge "storefront" / "Storefront").
function norm(s: string): string {
  return s.trim().toLowerCase();
}

// Anchor on the member code (keys carry a storage prefix, e.g. storage/dev/MA102/...).
function folderOf(key: string, memberId: string): string {
  const marker = `${memberId}/`;
  const idx = key.indexOf(marker);
  const rel = idx >= 0 ? key.slice(idx + marker.length) : key;
  const segs = rel.split("/").filter(Boolean);
  return segs.length > 1 ? segs[0] : "Other";
}

function sanitizeFolder(s: string): string {
  return s
    .trim()
    .replace(/[\\/]+/g, "-")
    .replace(/\s+/g, " ")
    .replace(/[^\w\- ]/g, "")
    .trim();
}

// The rendition we show as a grid thumbnail (small first) / default lightbox size.
function thumbKey(p: Photo): string {
  return p.renditions[256] ?? p.renditions[512] ?? p.renditions[1024] ?? p.original ?? p.source;
}

// PUT a chunk to S3 via XHR so we get upload progress; returns the part ETag.
function putWithProgress(
  url: string,
  body: Blob,
  contentType: string,
  onProgress: (loaded: number) => void
): Promise<string | undefined> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url);
    xhr.setRequestHeader("Content-Type", contentType);
    xhr.upload.onprogress = (e) => onProgress(e.loaded);
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve(xhr.getResponseHeader("ETag")?.replaceAll('"', "") ?? undefined);
      } else {
        reject(new Error("S3 PUT failed"));
      }
    };
    xhr.onerror = () => reject(new Error("S3 PUT failed"));
    xhr.send(body);
  });
}

type UploadJob = { id: string; name: string; pct: number; error?: boolean };

export function CustomerPhotos({
  memberId,
  customerId,
  initialCaptions,
}: {
  memberId: string;
  customerId?: number;
  initialCaptions?: Record<string, string>;
}) {
  const canUpload = useCan("customer_data:create");
  const canDelete = useCan("customer_data:delete");
  const canEditCaption = useCan("customer_data:update");

  const [captions, setCaptions] = useState<Record<string, string>>(initialCaptions ?? {});

  function audit(message: string) {
    if (customerId) void logPhotoActivity(customerId, message);
  }

  async function saveCaption(photoKey: string, text: string) {
    if (!customerId) return;
    const r = await savePhotoCaption(customerId, photoKey, text);
    if (r.ok) {
      setCaptions((prev) => {
        const next = { ...prev };
        if (text.trim()) next[photoKey] = text.trim();
        else delete next[photoKey];
        return next;
      });
      toast.success("Caption saved.");
    } else {
      toast.error(r.error ?? "Failed to save caption.");
    }
  }

  const [keys, setKeys] = useState<string[]>([]); // all object keys for this customer
  const [urls, setUrls] = useState<Record<string, string>>({}); // object key -> presigned URL
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploads, setUploads] = useState<UploadJob[]>([]); // per-file progress
  const [dragOver, setDragOver] = useState(false);
  const [selected, setSelected] = useState<string>(""); // chosen folder; "" → auto-pick
  const [uploadFolder, setUploadFolder] = useState<string>("");
  const [newFolderName, setNewFolderName] = useState("");
  const [lightbox, setLightbox] = useState<number | null>(null);
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [confirm, setConfirm] = useState<{ kind: "single" | "bulk"; photo?: Photo } | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [view, setView] = useState<string>("1024"); // "256" | "512" | "1024" | "original"
  const [playing, setPlaying] = useState(false); // slideshow
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const dragRef = useRef<{ x: number; y: number } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);

  const loadIndex = useCallback(async () => {
    try {
      const res = await fetch(`/api/files/List?filePath=${encodeURIComponent(memberId)}`, {
        cache: "no-store",
      });
      const body = res.ok ? await readJson(res) : [];
      const imgKeys = (Array.isArray(body) ? body : []).filter(
        (p): p is string => typeof p === "string" && IMAGE_RE.test(p)
      );
      setKeys(imgKeys);
    } catch {
      setKeys([]);
    } finally {
      setLoading(false);
    }
  }, [memberId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadIndex();
  }, [loadIndex]);

  // Keep a stable handle to the latest onFiles for window-level listeners (paste).
  const onFilesRef = useRef<(files: FileList | null) => Promise<void>>(() => Promise.resolve());
  useEffect(() => {
    onFilesRef.current = onFiles;
  });

  // Paste an image from the clipboard to upload it into the selected folder.
  useEffect(() => {
    if (!canUpload) return;
    function onPaste(e: ClipboardEvent) {
      const imgs = Array.from(e.clipboardData?.items ?? [])
        .filter((it) => it.kind === "file" && it.type.startsWith("image/"))
        .map((it) => it.getAsFile())
        .filter((f): f is File => !!f);
      if (imgs.length === 0) return;
      const dt = new DataTransfer();
      imgs.forEach((f) => dt.items.add(f));
      void onFilesRef.current(dt.files);
    }
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, [canUpload]);

  // Collapse the raw object keys into source photos (original + renditions).
  const photos = useMemo(() => {
    const map = new Map<string, Photo>();
    for (const key of keys) {
      const name = fileNameOf(key);
      const m = name.match(RENDITION_RE);
      // Identity = the original photo key with its extension stripped. The worker stores
      // renditions under a "_v" container: {folder}/_v/{name}/wN.webp, while the original
      // is {folder}/{name}.ext. So for a rendition, take its parent dir and drop the "_v"
      // segment; for an original, just strip the extension. Both then resolve to
      // {folder}/{name} and collapse into ONE photo.
      let source: string;
      if (m) {
        const parent = key.slice(0, key.length - name.length - 1);
        source = stripImageExt(parent.replace(/\/_v\/([^/]+)$/, "/$1"));
      } else {
        source = stripImageExt(key);
      }
      let p = map.get(source);
      if (!p) {
        p = { source, folder: folderOf(source, memberId), name: fileNameOf(source), renditions: {} };
        map.set(source, p);
      }
      if (m) {
        p.renditions[Number(m[1])] = key;
      } else {
        p.original = key;
        p.name = name;
        p.folder = folderOf(key, memberId);
      }
    }
    // Newest first (timestamp-prefixed names sort lexically).
    return Array.from(map.values()).sort((a, b) => (a.name < b.name ? 1 : a.name > b.name ? -1 : 0));
  }, [keys, memberId]);

  // Group by normalized (case-insensitive) folder identity.
  const grouped = useMemo(() => {
    const m: Record<string, Photo[]> = {};
    for (const p of photos) (m[norm(p.folder)] ??= []).push(p);
    return m;
  }, [photos]);

  // Nav folders: fixed legacy set + any extra found in storage, deduped
  // case-insensitively. `norm` is the identity; `key` is the canonical segment used
  // for uploads; `label` is what we show.
  const folders = useMemo(() => {
    const list: { norm: string; key: string; label: string }[] = LEGACY_FOLDERS.map((f) => ({
      norm: norm(f.key),
      key: f.key,
      label: f.label,
    }));
    const known = new Set(list.map((f) => f.norm));
    for (const p of photos) {
      const n = norm(p.folder);
      if (!known.has(n)) {
        known.add(n);
        list.push({ norm: n, key: p.folder, label: p.folder });
      }
    }
    return list;
  }, [photos]);

  const firstWithPhotos = useMemo(
    () => folders.find((f) => (grouped[f.norm]?.length ?? 0) > 0)?.norm,
    [folders, grouped]
  );
  const activeFolder = selected || firstWithPhotos || folders[0]?.norm || ""; // normalized id
  const visiblePhotos = useMemo(() => grouped[activeFolder] ?? [], [grouped, activeFolder]);

  function folderLabel(n: string): string {
    return folders.find((f) => f.norm === n)?.label ?? n;
  }
  function folderKey(n: string): string {
    return folders.find((f) => f.norm === n)?.key ?? n;
  }

  const customFolder = sanitizeFolder(newFolderName);
  const targetFolder =
    uploadFolder === NEW_FOLDER ? customFolder : folderKey(uploadFolder || activeFolder);

  const selectedLabel = activeFolder ? folderLabel(activeFolder) : "—";

  // Lazily presign grid thumbnails as tiles scroll into view, through a bounded queue
  // so a big folder never fires dozens of presign calls at once.
  const inflightRef = useRef(0);
  const queueRef = useRef<string[]>([]);
  const requestedRef = useRef<Set<string>>(new Set());
  const pump = useCallback(() => {
    while (inflightRef.current < 6 && queueRef.current.length > 0) {
      const key = queueRef.current.shift()!;
      inflightRef.current++;
      (async () => {
        try {
          const r = await fetch(`/api/files/PreSignedUrl?filePath=${encodeURIComponent(key)}`);
          if (r.ok) {
            const url = pick(await readJson(r), "url", "Url");
            if (url && /^https?:\/\//i.test(url)) setUrls((prev) => ({ ...prev, [key]: url }));
          }
        } catch {
          /* ignore */
        } finally {
          inflightRef.current--;
          pump();
        }
      })();
    }
  }, []);
  const requestThumb = useCallback(
    (key: string) => {
      if (!key || requestedRef.current.has(key)) return;
      requestedRef.current.add(key);
      queueRef.current.push(key);
      pump();
    },
    [pump]
  );

  // The photo + object key currently shown in the lightbox, per the selected size.
  const current = lightbox !== null ? visiblePhotos[lightbox] : undefined;
  const availableSizes = useMemo(
    () => (current ? Object.keys(current.renditions).map(Number).sort((a, b) => a - b) : []),
    [current]
  );
  const currentKey = useMemo(() => {
    if (!current) return undefined;
    if (view === "original") return current.original ?? thumbKey(current);
    const w = Number(view);
    return current.renditions[w] ?? current.original ?? thumbKey(current);
  }, [current, view]);

  // Resolve the lightbox image URL on demand (originals/large sizes aren't pre-fetched).
  useEffect(() => {
    if (!currentKey || urls[currentKey]) return;
    let active = true;
    (async () => {
      try {
        const r = await fetch(`/api/files/PreSignedUrl?filePath=${encodeURIComponent(currentKey)}`);
        if (!r.ok) return;
        const url = pick(await readJson(r), "url", "Url");
        if (active && url && /^https?:\/\//i.test(url)) {
          setUrls((prev) => ({ ...prev, [currentKey]: url }));
        }
      } catch {
        /* ignore */
      }
    })();
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentKey]);

  // Reset zoom/pan whenever the shown image changes (intentional, not cascading).
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setZoom(1);
    setPan({ x: 0, y: 0 });
    setRotation(0);
  }, [currentKey]);

  async function downloadCurrent() {
    if (!currentKey || !urls[currentKey] || !current) return;
    try {
      const res = await fetch(urls[currentKey]);
      const blob = await res.blob();
      const href = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = href;
      a.download = current.name;
      a.click();
      URL.revokeObjectURL(href);
    } catch {
      toast.error("Download failed.");
    }
  }

  function defaultViewFor(p?: Photo): string {
    const sizes = p ? Object.keys(p.renditions).map(Number) : [];
    return sizes.includes(1024) ? "1024" : sizes.length ? String(Math.max(...sizes)) : "original";
  }

  // Open or navigate the lightbox. ALWAYS (re)default to 1024 so opening and paging
  // never load the heavy original — that only happens when the user taps "View original".
  function showAt(i: number) {
    const n = visiblePhotos.length;
    if (n === 0) return;
    const idx = ((i % n) + n) % n;
    setLightbox(idx);
    setView(defaultViewFor(visiblePhotos[idx]));
  }
  function closeLightbox() {
    setLightbox(null);
    setPlaying(false);
  }

  // Keyboard nav.
  useEffect(() => {
    if (lightbox === null) return;
    const at = lightbox;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") closeLightbox();
      else if (e.key === "ArrowRight") showAt(at + 1);
      else if (e.key === "ArrowLeft") showAt(at - 1);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lightbox, visiblePhotos]);

  // Slideshow: auto-advance every 3s while playing.
  useEffect(() => {
    if (!playing || lightbox === null) return;
    const at = lightbox;
    const id = window.setInterval(() => showAt(at + 1), 3000);
    return () => window.clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing, lightbox, visiblePhotos.length]);

  async function uploadOne(file: File, folder: string, onProgress?: (loaded: number) => void) {
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
    const loadedPerPart = new Array<number>(totalParts).fill(0);
    const report = () => onProgress?.(loadedPerPart.reduce((a, b) => a + b, 0));
    const parts = await Promise.all(
      Array.from({ length: totalParts }, (_, i) => i + 1).map(async (partNumber) => {
        const urlRes = await fetch(
          `/api/files/Multipart/GetUrl?filePath=${encodeURIComponent(filePath)}&uploadId=${encodeURIComponent(uploadId)}&partNumber=${partNumber}`
        );
        if (!urlRes.ok) throw new Error("Failed to get part URL");
        const presigned = pick(await readJson(urlRes), "url", "Url");
        if (!presigned || !/^https?:\/\//i.test(presigned)) {
          throw new Error("File worker did not return a valid upload URL (check API key).");
        }
        const start = (partNumber - 1) * CHUNK_SIZE;
        const chunk = file.slice(start, Math.min(start + CHUNK_SIZE, file.size));
        const eTag = await putWithProgress(presigned, chunk, contentType, (loaded) => {
          loadedPerPart[partNumber - 1] = loaded;
          report();
        });
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
    const list = Array.from(files);
    const jobs: UploadJob[] = list.map((f, i) => ({
      id: `${Date.now()}-${i}-${f.name}`,
      name: f.name,
      pct: 0,
    }));
    setUploads(jobs);
    setUploading(true);
    let ok = 0;
    for (let i = 0; i < list.length; i++) {
      const file = list[i];
      const id = jobs[i].id;
      try {
        // Auto-orient / downscale / HEIC->JPEG before upload (best-effort).
        const prepared = await prepareImage(file);
        await uploadOne(prepared, folder, (loaded) => {
          const pct = Math.min(99, Math.round((loaded / Math.max(1, prepared.size)) * 100));
          setUploads((prev) => prev.map((u) => (u.id === id ? { ...u, pct } : u)));
        });
        setUploads((prev) => prev.map((u) => (u.id === id ? { ...u, pct: 100 } : u)));
        ok++;
      } catch {
        setUploads((prev) => prev.map((u) => (u.id === id ? { ...u, error: true } : u)));
        toast.error(`Upload failed: ${file.name}`);
      }
    }
    setUploading(false);
    window.setTimeout(() => setUploads([]), 1500);
    if (inputRef.current) inputRef.current.value = "";
    if (cameraRef.current) cameraRef.current.value = "";
    if (ok > 0) {
      toast.success(`Uploaded ${ok} photo${ok > 1 ? "s" : ""} to ${folder}.`);
      audit(`Uploaded ${ok} photo${ok > 1 ? "s" : ""} to ${folder}.`);
      setSelected(norm(folder)); // jump to that folder (normalized identity)
      setUploadFolder("");
      setNewFolderName("");
      void loadIndex();
    }
  }

  function photoKeys(p: Photo): string[] {
    return [p.original, ...Object.values(p.renditions)].filter(Boolean) as string[];
  }

  // Delete a set of object keys (original + renditions). Returns whether any succeeded.
  async function deleteObjects(targets: string[]): Promise<boolean> {
    const results = await Promise.all(
      targets.map((key) =>
        fetch(`/api/files/Delete?filePath=${encodeURIComponent(key)}`, { method: "DELETE" })
          .then((r) => r.ok)
          .catch(() => false)
      )
    );
    return results.some(Boolean);
  }

  function toggleSelect(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  // Photos pending deletion + count for the confirmation dialog.
  const confirmTargets =
    confirm?.kind === "bulk"
      ? visiblePhotos.filter((p) => selectedIds.has(p.source))
      : confirm?.photo
        ? [confirm.photo]
        : [];

  // Execute the confirmed delete. Removes each photo's folder-root original AND every
  // variant under its _v container (photoKeys gathers them all).
  async function performDelete() {
    if (confirmTargets.length === 0) {
      setConfirm(null);
      return;
    }
    const isBulk = confirm?.kind === "bulk";
    const targets = confirmTargets.flatMap(photoKeys);
    setDeleting(true);
    const ok = await deleteObjects(targets);
    setDeleting(false);
    setConfirm(null);
    if (!ok) {
      toast.error(isBulk ? "Failed to delete photos." : "Failed to delete photo.");
      return;
    }
    const removed = new Set(targets);
    setKeys((prev) => prev.filter((k) => !removed.has(k)));
    setLightbox(null);
    if (isBulk) {
      setSelectedIds(new Set());
      setSelectMode(false);
      toast.success(`Deleted ${confirmTargets.length} photo${confirmTargets.length > 1 ? "s" : ""}.`);
      audit(`Deleted ${confirmTargets.length} photo${confirmTargets.length > 1 ? "s" : ""} from ${selectedLabel}.`);
    } else {
      toast.success("Photo deleted.");
      audit(`Deleted a photo from ${folderLabel(confirmTargets[0].folder)}.`);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-lg font-semibold">
          <Images className="size-5" /> Photos
          <span
            className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-normal text-muted-foreground"
            title="Gallery build — confirms which CRM image is deployed"
          >
            {GALLERY_BUILD}
          </span>
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
                <option key={f.norm} value={f.norm}>
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
            {/* On phones/tablets this opens the camera; on desktop it's a file picker. */}
            <input
              ref={cameraRef}
              type="file"
              accept="image/*"
              capture="environment"
              hidden
              onChange={(e) => onFiles(e.target.files)}
            />
            <Button
              variant="outline"
              onClick={() => cameraRef.current?.click()}
              disabled={uploading || (uploadFolder === NEW_FOLDER && !customFolder)}
              aria-label="Take photo"
            >
              <Camera /> Camera
            </Button>
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

      {uploads.length > 0 && (
        <div className="space-y-1.5">
          {uploads.map((u) => (
            <div key={u.id} className="flex items-center gap-2 text-xs">
              <span className="w-40 truncate text-muted-foreground">{u.name}</span>
              <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                <div
                  className={`h-full rounded-full transition-all ${u.error ? "bg-destructive" : "bg-brand"}`}
                  style={{ width: `${u.error ? 100 : u.pct}%` }}
                />
              </div>
              <span className="w-10 text-right tabular-nums text-muted-foreground">
                {u.error ? "fail" : `${u.pct}%`}
              </span>
            </div>
          ))}
        </div>
      )}

      {loading ? (
        <div className="flex h-24 items-center justify-center text-sm text-muted-foreground">
          <Loader2 className="mr-2 animate-spin" /> Loading photos…
        </div>
      ) : (
        <div className="gap-4 md:grid md:grid-cols-[210px_minmax(0,1fr)]">
          <nav className="mb-3 flex gap-1 overflow-x-auto md:mb-0 md:flex-col md:overflow-visible">
            {folders.map((f) => (
              <FolderButton
                key={f.norm}
                label={f.label}
                count={grouped[f.norm]?.length ?? 0}
                active={activeFolder === f.norm}
                onClick={() => {
                  setSelected(f.norm);
                  setLightbox(null);
                  setSelectMode(false);
                  setSelectedIds(new Set());
                }}
              />
            ))}
          </nav>

          <div
            className={`min-w-0 rounded-lg transition-shadow ${
              dragOver ? "ring-2 ring-brand ring-offset-2 ring-offset-background" : ""
            }`}
            onDragOver={
              canUpload
                ? (e) => {
                    e.preventDefault();
                    setDragOver(true);
                  }
                : undefined
            }
            onDragLeave={canUpload ? () => setDragOver(false) : undefined}
            onDrop={
              canUpload
                ? (e) => {
                    e.preventDefault();
                    setDragOver(false);
                    void onFiles(e.dataTransfer.files);
                  }
                : undefined
            }
          >
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <span className="text-sm text-muted-foreground">
                {selectedLabel} · {visiblePhotos.length} photo{visiblePhotos.length === 1 ? "" : "s"}
                {canUpload && <span className="ml-2 hidden sm:inline">· drop or paste images to upload</span>}
              </span>
              {canDelete && visiblePhotos.length > 0 && (
                selectMode ? (
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">{selectedIds.size} selected</span>
                    <Button
                      size="sm"
                      variant="destructive"
                      disabled={selectedIds.size === 0}
                      onClick={() => setConfirm({ kind: "bulk" })}
                    >
                      <Trash2 /> Delete
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        setSelectMode(false);
                        setSelectedIds(new Set());
                      }}
                    >
                      Cancel
                    </Button>
                  </div>
                ) : (
                  <Button size="sm" variant="outline" onClick={() => setSelectMode(true)}>
                    <CheckSquare /> Select
                  </Button>
                )
              )}
            </div>
            {visiblePhotos.length === 0 ? (
              <div className="rounded-md border border-dashed p-8 text-center text-sm text-muted-foreground">
                No photos in {selectedLabel} for {memberId}.
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                {visiblePhotos.map((p, i) => (
                  <PhotoTile
                    key={p.source}
                    photo={p}
                    url={urls[thumbKey(p)]}
                    caption={captions[p.source]}
                    selectMode={selectMode}
                    isSelected={selectedIds.has(p.source)}
                    canDelete={canDelete}
                    onRequest={requestThumb}
                    onOpen={() => showAt(i)}
                    onToggle={() => toggleSelect(p.source)}
                    onDelete={() => setConfirm({ kind: "single", photo: p })}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Lightbox: size selector (default 1024) + View original + zoom/pan */}
      {current && (
        <div className="fixed inset-0 z-50 flex flex-col bg-black/90" onClick={closeLightbox}>
          {/* Toolbar */}
          <div
            className="flex flex-wrap items-center justify-between gap-2 p-3 text-white"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex flex-wrap items-center gap-1">
              {availableSizes.map((w) => (
                <button
                  key={w}
                  type="button"
                  onClick={() => setView(String(w))}
                  className={`rounded-md px-2.5 py-1 text-xs ${
                    view === String(w) ? "bg-white text-black" : "bg-white/10 hover:bg-white/20"
                  }`}
                >
                  {w}px
                </button>
              ))}
              {current.original && (
                <button
                  type="button"
                  onClick={() => setView("original")}
                  className={`rounded-md px-2.5 py-1 text-xs ${
                    view === "original" ? "bg-white text-black" : "bg-white/10 hover:bg-white/20"
                  }`}
                >
                  <Maximize2 className="mr-1 inline size-3.5" /> Original
                </button>
              )}
            </div>
            <div className="flex items-center gap-1">
              <button
                type="button"
                aria-label="Zoom out"
                className="rounded-md bg-white/10 p-2 hover:bg-white/20"
                onClick={() => setZoom((z) => Math.max(1, +(z / 1.3).toFixed(2)))}
              >
                <ZoomOut className="size-4" />
              </button>
              <span className="w-12 text-center text-xs tabular-nums">{Math.round(zoom * 100)}%</span>
              <button
                type="button"
                aria-label="Zoom in"
                className="rounded-md bg-white/10 p-2 hover:bg-white/20"
                onClick={() => setZoom((z) => Math.min(8, +(z * 1.3).toFixed(2)))}
              >
                <ZoomIn className="size-4" />
              </button>
              <button
                type="button"
                aria-label="Rotate"
                className="rounded-md bg-white/10 p-2 hover:bg-white/20"
                onClick={() => setRotation((r) => (r + 90) % 360)}
              >
                <RotateCw className="size-4" />
              </button>
              <button
                type="button"
                aria-label="Download"
                className="rounded-md bg-white/10 p-2 hover:bg-white/20"
                onClick={() => void downloadCurrent()}
              >
                <Download className="size-4" />
              </button>
              <button
                type="button"
                aria-label="Open in new tab"
                className="rounded-md bg-white/10 p-2 hover:bg-white/20"
                onClick={() => currentKey && urls[currentKey] && window.open(urls[currentKey], "_blank", "noopener")}
              >
                <ExternalLink className="size-4" />
              </button>
              {visiblePhotos.length > 1 && (
                <button
                  type="button"
                  aria-label={playing ? "Pause slideshow" : "Play slideshow"}
                  className="rounded-md bg-white/10 p-2 hover:bg-white/20"
                  onClick={() => setPlaying((s) => !s)}
                >
                  {playing ? <Pause className="size-4" /> : <Play className="size-4" />}
                </button>
              )}
              {canDelete && (
                <button
                  type="button"
                  aria-label="Delete photo"
                  className="ml-1 rounded-md bg-white/10 p-2 hover:bg-white/20"
                  onClick={() => setConfirm({ kind: "single", photo: current })}
                >
                  <Trash2 className="size-4" />
                </button>
              )}
              <button
                type="button"
                aria-label="Close"
                className="ml-1 rounded-md bg-white/10 p-2 hover:bg-white/20"
                onClick={closeLightbox}
              >
                <X className="size-4" />
              </button>
            </div>
          </div>

          {/* Stage */}
          <div
            className="relative flex flex-1 items-center justify-center overflow-hidden"
            onClick={(e) => e.stopPropagation()}
            onWheel={(e) =>
              setZoom((z) => Math.min(8, Math.max(1, +(z * (e.deltaY < 0 ? 1.1 : 0.9)).toFixed(2))))
            }
            onPointerDown={(e) => {
              if (zoom <= 1) return;
              dragRef.current = { x: e.clientX - pan.x, y: e.clientY - pan.y };
              setDragging(true);
            }}
            onPointerMove={(e) => {
              if (!dragRef.current) return;
              setPan({ x: e.clientX - dragRef.current.x, y: e.clientY - dragRef.current.y });
            }}
            onPointerUp={() => {
              dragRef.current = null;
              setDragging(false);
            }}
            onPointerLeave={() => {
              dragRef.current = null;
              setDragging(false);
            }}
            style={{ cursor: zoom > 1 ? (dragging ? "grabbing" : "grab") : "default" }}
          >
            {visiblePhotos.length > 1 && (
              <button
                type="button"
                aria-label="Previous photo"
                className="absolute left-2 top-1/2 z-10 -translate-y-1/2 rounded-full bg-white/10 p-3 text-white hover:bg-white/20 sm:left-6"
                onClick={() => showAt((lightbox ?? 0) - 1)}
              >
                <ChevronLeft />
              </button>
            )}

            {currentKey && urls[currentKey] ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={urls[currentKey]}
                alt={current.name}
                draggable={false}
                className="max-h-full max-w-full select-none object-contain"
                style={{
                  transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom}) rotate(${rotation}deg)`,
                  transition: dragging ? "none" : "transform 0.1s ease-out",
                }}
              />
            ) : (
              <Loader2 className="size-8 animate-spin text-white/70" />
            )}

            {visiblePhotos.length > 1 && (
              <button
                type="button"
                aria-label="Next photo"
                className="absolute right-2 top-1/2 z-10 -translate-y-1/2 rounded-full bg-white/10 p-3 text-white hover:bg-white/20 sm:right-6"
                onClick={() => showAt((lightbox ?? 0) + 1)}
              >
                <ChevronRight />
              </button>
            )}
          </div>

          {/* Caption (view/edit) + meta */}
          <div className="space-y-2 p-3 text-center" onClick={(e) => e.stopPropagation()}>
            <CaptionBar
              key={current.source}
              initial={captions[current.source] ?? ""}
              canEdit={canEditCaption}
              onSave={(text) => saveCaption(current.source, text)}
            />
            <div className="truncate text-xs text-white/70">
              {current.name} · {lightbox! + 1}/{visiblePhotos.length} ·{" "}
              {view === "original" ? "original" : `${view}px`}
            </div>
          </div>
        </div>
      )}

      {/* Permanent-delete confirmation (single or bulk) */}
      {confirm && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4"
          onClick={() => !deleting && setConfirm(null)}
        >
          <div
            role="alertdialog"
            aria-modal="true"
            className="w-full max-w-sm rounded-lg border bg-background p-6 shadow-lg"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="flex items-center gap-2 text-base font-semibold">
              <Trash2 className="size-4 text-destructive" />
              Delete {confirmTargets.length} photo{confirmTargets.length === 1 ? "" : "s"}?
            </h3>
            <p className="mt-2 text-sm text-muted-foreground">
              This <span className="font-medium text-foreground">permanently</span> deletes the
              {confirmTargets.length === 1 ? " photo" : ` ${confirmTargets.length} photos`} and all
              image sizes (variants) from storage. This action cannot be undone.
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setConfirm(null)} disabled={deleting}>
                No, cancel
              </Button>
              <Button variant="destructive" onClick={() => void performDelete()} disabled={deleting}>
                {deleting ? <Loader2 className="animate-spin" /> : <Trash2 />}
                Yes, delete
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// A grid tile that presigns its thumbnail only once it scrolls near the viewport.
function PhotoTile({
  photo,
  url,
  caption,
  selectMode,
  isSelected,
  canDelete,
  onRequest,
  onOpen,
  onToggle,
  onDelete,
}: {
  photo: Photo;
  url?: string;
  caption?: string;
  selectMode: boolean;
  isSelected: boolean;
  canDelete: boolean;
  onRequest: (key: string) => void;
  onOpen: () => void;
  onToggle: () => void;
  onDelete: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const tk = thumbKey(photo);
  useEffect(() => {
    if (url) return;
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          onRequest(tk);
          obs.disconnect();
        }
      },
      { rootMargin: "300px" }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [url, tk, onRequest]);

  return (
    <div
      ref={ref}
      className={`group relative overflow-hidden rounded-md border bg-muted/30 ${
        selectMode && isSelected ? "ring-2 ring-brand" : ""
      }`}
    >
      {url ? (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={url}
            alt={photo.name}
            loading="lazy"
            className="aspect-square w-full cursor-pointer object-cover"
            onClick={() => (selectMode ? onToggle() : onOpen())}
          />
          {selectMode ? (
            <button
              type="button"
              onClick={onToggle}
              aria-label={isSelected ? "Deselect" : "Select"}
              className={`absolute left-1 top-1 flex size-6 items-center justify-center rounded-md border ${
                isSelected
                  ? "border-brand bg-brand text-white"
                  : "border-white/70 bg-black/40 text-transparent"
              }`}
            >
              <Check className="size-4" />
            </button>
          ) : (
            canDelete && (
              <button
                type="button"
                onClick={onDelete}
                aria-label="Delete photo"
                className="absolute right-1 top-1 rounded-md bg-black/60 p-1 text-white opacity-0 transition-opacity hover:bg-black/80 group-hover:opacity-100"
              >
                <Trash2 className="size-4" />
              </button>
            )
          )}
          {caption && (
            <div className="pointer-events-none absolute inset-x-0 bottom-0 truncate bg-linear-to-t from-black/70 to-transparent px-1.5 pb-1 pt-3 text-[11px] text-white">
              {caption}
            </div>
          )}
        </>
      ) : (
        <div className="flex aspect-square w-full items-center justify-center">
          <Loader2 className="size-5 animate-spin text-muted-foreground" />
        </div>
      )}
    </div>
  );
}

function CaptionBar({
  initial,
  canEdit,
  onSave,
}: {
  initial: string;
  canEdit: boolean;
  onSave: (text: string) => Promise<void> | void;
}) {
  const [draft, setDraft] = useState(initial);
  const [saving, setSaving] = useState(false);

  if (!canEdit) {
    return initial ? <p className="mx-auto max-w-lg text-sm text-white">{initial}</p> : null;
  }
  return (
    <div className="mx-auto flex max-w-lg items-center gap-2">
      <input
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        placeholder="Add a caption…"
        className="h-9 flex-1 rounded-md border border-white/20 bg-white/10 px-2 text-sm text-white placeholder:text-white/40 outline-none focus-visible:border-white/40"
      />
      <Button
        size="sm"
        variant="secondary"
        disabled={saving || draft === initial}
        onClick={async () => {
          setSaving(true);
          await onSave(draft);
          setSaving(false);
        }}
      >
        {saving && <Loader2 className="animate-spin" />}
        Save
      </Button>
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
