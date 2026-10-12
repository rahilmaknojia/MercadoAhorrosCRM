// Client-side image preparation for uploads (field capture friendly):
//  - auto-applies EXIF orientation (so sideways phone photos upload upright),
//  - downscales very large images,
//  - re-encodes HEIC/HEIF to JPEG: natively where the browser can decode it (Safari), otherwise
//    with a lazily loaded WASM decoder (Chrome/Edge/Firefox),
//  - compresses big photos to save upload bandwidth and storage.
//
// Everything is best-effort: any failure returns the original File unchanged so an upload never
// breaks because of preprocessing — EXCEPT a HEIC that can't be converted at all. Neither the CRM
// gallery, the mobile app nor the image worker can show a raw HEIC, so uploading it would
// "succeed" and then never appear; that throws HeicConversionError instead.

export class HeicConversionError extends Error {
  constructor(name: string) {
    super(`${name} is a HEIC photo that couldn't be converted. Save it as JPEG and try again.`);
    this.name = "HeicConversionError";
  }
}

// heic2any is ~1 MB of WASM, so it's only loaded when a HEIC actually needs it.
async function heicToJpeg(file: File): Promise<File> {
  const { default: heic2any } = await import("heic2any");
  const out = await heic2any({ blob: file, toType: "image/jpeg", quality: QUALITY });
  const blob = Array.isArray(out) ? out[0] : out;
  return new File([blob], jpgName(file.name), { type: "image/jpeg", lastModified: file.lastModified });
}

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
    if (!isHeic(file)) return file; // browser can't decode it → upload as-is
    // HEIC on a browser without native support: convert, then run the JPEG through the rest.
    let jpeg: File;
    try {
      jpeg = await heicToJpeg(file);
    } catch {
      throw new HeicConversionError(file.name);
    }
    return prepareImage(jpeg);
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
