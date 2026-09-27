// Deterministic badge colour per tag, so the same tag always looks the same across the app.
// The class strings are literals here so Tailwind's content scan picks them up.
const TAG_PALETTE = [
  "bg-blue-500/15 text-blue-600 dark:text-blue-400",
  "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
  "bg-amber-500/15 text-amber-700 dark:text-amber-400",
  "bg-violet-500/15 text-violet-600 dark:text-violet-400",
  "bg-rose-500/15 text-rose-600 dark:text-rose-400",
  "bg-cyan-500/15 text-cyan-700 dark:text-cyan-400",
  "bg-orange-500/15 text-orange-700 dark:text-orange-400",
];

export function tagBadgeClass(tag: string): string {
  let hash = 0;
  for (let i = 0; i < tag.length; i++) hash = (hash * 31 + tag.charCodeAt(i)) >>> 0;
  return TAG_PALETTE[hash % TAG_PALETTE.length];
}

// Customer fields an eSignature template can map (merge tokens + signer name/email/phone).
// Mirrors the API's CustomerFieldAccessor — add a field there first, then here. Deliberately
// separate from the reports' CUSTOMER_FIELDS, which is limited to what report filters support.
export const ESIGN_CUSTOMER_FIELD_GROUPS = [
  {
    label: "Member",
    fields: [
      { value: "memberId", label: "Member ID" },
      { value: "status", label: "Status" },
      { value: "dateJoined", label: "Date joined" },
      { value: "dateInactive", label: "Date inactive" },
      { value: "inactiveReason", label: "Inactive reason" },
      { value: "reinstated", label: "Reinstated" },
      { value: "signedBy", label: "Signed by" },
      { value: "comments", label: "Comments" },
    ],
  },
  {
    label: "Business",
    fields: [
      { value: "businessName", label: "Business name" },
      { value: "corpName", label: "Corporate name" },
      { value: "salesTaxId", label: "Sales tax ID" },
      { value: "federalTaxId", label: "Federal tax ID" },
    ],
  },
  {
    label: "Contact",
    fields: [
      { value: "contactName", label: "Contact name" },
      { value: "personTitle", label: "Title" },
      { value: "email", label: "Email" },
      { value: "storePhone", label: "Store phone" },
      { value: "cellPhone", label: "Cell phone" },
      { value: "storeFax", label: "Store fax" },
    ],
  },
  {
    label: "Store address",
    fields: [
      { value: "storeFullAddress", label: "Store address (one line)" },
      { value: "storeAddress", label: "Store street" },
      { value: "storeCity", label: "Store city" },
      { value: "storeState", label: "Store state" },
      { value: "storeZipcode", label: "Store ZIP" },
    ],
  },
  {
    label: "Mailing address",
    fields: [
      { value: "mailingFullAddress", label: "Mailing address (one line)" },
      { value: "mailingAddress", label: "Mailing street" },
      { value: "mailingCity", label: "Mailing city" },
      { value: "mailingState", label: "Mailing state" },
      { value: "mailingZipcode", label: "Mailing ZIP" },
    ],
  },
  {
    label: "Territory",
    fields: [
      { value: "region", label: "Region" },
      { value: "district", label: "District" },
      { value: "zoneNo", label: "Zone no." },
      { value: "zoneManager", label: "Zone manager" },
      { value: "storeGroup", label: "Store group" },
    ],
  },
] as const;

/** Templates as customer pages list them: required first, then the admin's order, then name. */
export function sortTemplatesForDisplay<T extends { isRequired?: boolean; sortOrder?: number; name: string }>(
  templates: T[]
): T[] {
  return [...templates].sort(
    (a, b) =>
      Number(!!b.isRequired) - Number(!!a.isRequired) ||
      (a.sortOrder ?? 0) - (b.sortOrder ?? 0) ||
      a.name.localeCompare(b.name)
  );
}
