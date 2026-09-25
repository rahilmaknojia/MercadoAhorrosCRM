/**
 * Builders and a checker for the sections the CRM writes into a customer's StoreMetadata JSONB
 * document. Pure and client-safe; the server-side writer is `patchStoreMetadata` (./patch.ts).
 *
 * The document invariants (docs/07, the API's `Application/Import/MetadataDocument.cs`) fail
 * silently, not loudly — a violation only shows up later as a report that matches the wrong
 * stores — so every writer goes through these helpers:
 *
 *  - I1 present implies true: a flag is `true` or absent, never `false`/`null`. A stored null is
 *    jsonb null, not SQL NULL, so `exists` (`-> 'k' IS NOT NULL`) would match every store.
 *  - I2 prune empty objects: a bare `{ mid_size: {} }` makes `coolers.mid_size|exists` true.
 *  - I3 keys match `^[A-Za-z0-9_]+$`, so they are addressable by the report filter paths.
 *  - I4 counts are JSON integers (0 allowed), absent when blank, so gte/between (::numeric) work.
 *  - Text is trimmed and absent when blank.
 *  - No arrays: sets are objects of `key: true`.
 *
 * A section's *root* may still be `{}`: PATCH by-customer merges top-level keys with `||`, which
 * can add and replace keys but never delete them, so an emptied section is written as `{}`. That
 * only makes the meaningless container query (`coolers|exists`) true.
 */

export const METADATA_KEY_PATTERN = /^[A-Za-z0-9_]+$/;

/** Top-level keys beginning with `__` are app-internal blobs (captions, signature) — not report data. */
export const isReservedMetadataKey = (key: string) => key.startsWith("__");

/** A value the builders produce; `undefined` means "leave the key out". */
export type SectionValue = true | number | string | SectionObject;
export type SectionObject = { [key: string]: SectionValue };
type Draft = { [key: string]: SectionValue | Draft | undefined | null | false };

/** Thrown for input that cannot be written (a negative or fractional count). */
export class MetadataValueError extends Error {
  constructor(
    message: string,
    readonly reason: "negative" | "not_integer" | "not_number",
  ) {
    super(message);
    this.name = "MetadataValueError";
  }
}

/** I1: a checkbox/toggle → `true` or absent. */
export function flag(value: unknown): true | undefined {
  return value === true ? true : undefined;
}

/**
 * I4: a count input (string from an <input>, or a number) → a non-negative integer, or absent
 * when blank. Throws MetadataValueError for anything else rather than silently dropping it.
 */
export function count(raw: string | number | null | undefined): number | undefined {
  if (raw === null || raw === undefined) return undefined;
  if (typeof raw === "string" && raw.trim() === "") return undefined;
  const value = typeof raw === "number" ? raw : Number(raw.trim());
  if (!Number.isFinite(value)) throw new MetadataValueError("Counts must be numbers.", "not_number");
  if (value < 0) throw new MetadataValueError("Counts cannot be negative.", "negative");
  if (!Number.isInteger(value)) throw new MetadataValueError("Counts must be whole numbers.", "not_integer");
  return value;
}

/** Free text → trimmed, or absent when blank. */
export function text(raw: string | null | undefined): string | undefined {
  const trimmed = (raw ?? "").trim();
  return trimmed ? trimmed : undefined;
}

/** A set of selected codes → `{ code: true }` (I1, no arrays). Blank codes are ignored. */
export function flagSet(codes: Iterable<string>): SectionObject {
  const out: SectionObject = {};
  for (const code of codes) if (code) out[code] = true;
  return out;
}

/**
 * Builds a section from a draft object: drops `undefined`/`null`/`false`, and recursively prunes
 * objects left empty (I2). The root itself is returned even when empty (see the module note).
 */
export function section(draft: Draft): SectionObject {
  return prune(draft) ?? {};
}

function prune(draft: Draft): SectionObject | undefined {
  const out: SectionObject = {};
  for (const [key, value] of Object.entries(draft)) {
    if (value === undefined || value === null || value === false) continue;
    if (typeof value === "object") {
      const child = prune(value as Draft);
      if (child) out[key] = child;
    } else {
      out[key] = value;
    }
  }
  return Object.keys(out).length ? out : undefined;
}

/**
 * Checks a built section against the invariants and returns the violations (empty when valid).
 * `patchStoreMetadata` runs this on every non-reserved key before writing, as a backstop for
 * builders that were not used.
 */
export function metadataViolations(value: unknown, path = "", isRoot = true): string[] {
  const at = path || "(root)";
  if (value === true) return [];
  if (value === false || value === null || value === undefined) return [`${at}: store true or omit the key`];
  if (Array.isArray(value)) return [`${at}: arrays are not allowed`];
  switch (typeof value) {
    case "number":
      return Number.isInteger(value) && value >= 0 ? [] : [`${at}: counts must be non-negative integers`];
    case "string":
      return value.trim() === "" || value !== value.trim() ? [`${at}: text must be trimmed and non-blank`] : [];
    case "object": {
      const entries = Object.entries(value as Record<string, unknown>);
      if (entries.length === 0 && !isRoot) return [`${at}: empty objects must be pruned`];
      return entries.flatMap(([key, child]) => [
        ...(METADATA_KEY_PATTERN.test(key) ? [] : [`${path ? `${path}.` : ""}${key}: invalid key`]),
        ...metadataViolations(child, path ? `${path}.${key}` : key, false),
      ]);
    }
    default:
      return [`${at}: unsupported value`];
  }
}
