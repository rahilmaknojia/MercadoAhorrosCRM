// Client-side image preparation for uploads (field capture friendly):
//  - auto-applies EXIF orientation (so sideways phone photos upload upright),
//  - downscales very large images,
//  - re-encodes HEIC/HEIF to JPEG when the browser can decode it (iOS Safari can;
//    Chrome/Firefox can't — those fall back to uploading the original untouched),
//  - compresses big photos to save upload bandwidth and storage.
//
// Everything is best-effort: any failure returns the original File unchanged so an
// upload never breaks because of preprocessing.

const MAX_DIM = 2400; // longest edge of the stored "original"
const QUALITY = 0.85;
const BIG_BYTES = 1_500_000; // re-encode anything larger than ~1.5 MB

function isHeic(file: File): boolean {
  return /hei[cf]/i.test(file.type) || /\.(heic|heif)$/i.test(file.name);
}

function looksLikeImage(file: File): boolean {
  return file.type.startsWith("image/") || /\.(jpe?g|png|gif|webp|hei[cf])$/i.test(file.name);
}

function jpgName(name: string): string {
  return `${name.replace(/\.[^./\\]+$/, "")}.jpg`;
}

export async function prepareImage(file: File): Promise<File> {
  if (!looksLikeImage(file)) return file;

  let bitmap: ImageBitmap;
  try {
    // `from-image` bakes EXIF orientation into the pixels.
    bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    return file; // browser can't decode (e.g. HEIC on desktop Chrome) → upload as-is
  }

  const heic = isHeic(file);
  const longest = Math.max(bitmap.width, bitmap.height);
  const needsResize = longest > MAX_DIM;
  const big = file.size > BIG_BYTES;

  // Nothing to gain (already small, correctly sized, not HEIC) → keep the original.
  if (!heic && !needsResize && !big) {
    bitmap.close();
    return file;
  }

  const scale = needsResize ? MAX_DIM / longest : 1;
  const w = Math.max(1, Math.round(bitmap.width * scale));
  const h = Math.max(1, Math.round(bitmap.height * scale));

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    bitmap.close();
    return file;
  }
  ctx.drawImage(bitmap, 0, 0, w, h);
  bitmap.close();

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, "image/jpeg", QUALITY)
  );
  if (!blob) return file;

  // For non-HEIC, only adopt the re-encode if it actually saved space.
  if (!heic && blob.size >= file.size) return file;

  return new File([blob], jpgName(file.name), {
    type: "image/jpeg",
    lastModified: file.lastModified,
  });
}
