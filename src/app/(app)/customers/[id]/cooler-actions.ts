/**
 * The result shape the member page's server actions share.
 *
 * Coolers used to be saved from here through the generic StoreMetadata PATCH; they are now part
 * of the versioned site survey (see site-survey-actions.ts), which keeps a history.
 */
export type ActionResult = { ok: boolean; error?: string };
