export type Permissions = {
  userId: string | null;
  email: string | null;
  roles: string[];
  permissions: string[];
};

// An entry on the auth service's invitation allowlist. Account creation
// (Microsoft sign-in or email sign-up) is permitted only for invited emails.
export type InvitedEmail = {
  id: string;
  email: string;
  invitedBy?: string | null;
  createdAt: string;
};

// A user account as returned by the auth service admin list-users endpoint.
export type AdminUser = {
  id: string;
  name: string;
  email: string;
  role?: string | null;
  banned?: boolean | null;
  banReason?: string | null;
  createdAt: string;
};

export const APP_ROLES = ["owner", "admin", "staff", "user"] as const;
export type AppRole = (typeof APP_ROLES)[number];

// A managed master-data lookup value: a territory (region/district/zone/manager/group) or a
// cooler catalogue value (brand/package/shared combination).
export type MasterDataItem = {
  id: number;
  type: string;
  name: string;
  /** Stable slug; the StoreMetadata JSON key for catalogue types. Immutable across renames. */
  code: string;
  displayOrder: number;
  isActive: boolean;
  createdOn?: string;
  createdBy?: string;
  modifiedOn?: string | null;
};

// Territory lookups. type = API master-data type; field = the matching Customer string field.
// Every entry here is fetched as a suggestion source by the customer edit form, so only add a
// type whose values land in a Customer column — catalogue types go in COOLER_MASTER_DATA_TYPES.
export const MASTER_DATA_TYPES = [
  { type: "region", label: "Regions", field: "region" },
  { type: "district", label: "Districts", field: "district" },
  { type: "zone", label: "Zones", field: "zoneNo" },
  { type: "zoneManager", label: "Zone managers", field: "zoneManager" },
  { type: "storeGroup", label: "Store groups", field: "storeGroup" },
] as const;

// Catalogue lookups for the store cooler footprint. These are many-per-customer and are
// referenced from StoreMetadata JSON by their Code, so they have no Customer field.
export const COOLER_MASTER_DATA_TYPES = [
  { type: "coolerBrand", label: "Cooler brands" },
  { type: "coolerPackage", label: "Cooler packages" },
  { type: "sharedCooler", label: "Shared cooler combinations" },
] as const;

// Everything the master-data admin screen manages.
export const MANAGED_MASTER_DATA_TYPES = [
  ...MASTER_DATA_TYPES.map((t) => ({ type: t.type as string, label: t.label as string })),
  ...COOLER_MASTER_DATA_TYPES.map((t) => ({ type: t.type as string, label: t.label as string })),
];

/** Fixed structural dimension of the cooler document — not master data. */
export const COOLER_TYPES = [
  { key: "standing", label: "Standing Cooler" },
  { key: "counter_top", label: "Counter-Top Cooler" },
  { key: "mid_size", label: "Mid-Size Cooler" },
] as const;

export type CoolerTypeKey = (typeof COOLER_TYPES)[number]["key"];

/**
 * The cooler section of a customer's StoreMetadata document.
 * Shape: coolers.<coolerType>.<brandCode>.<packageCode> = true
 *
 * Invariants (these fail silently, not loudly — see the API's CoolerMetadataKeys):
 *  - present implies true; never write `false`/`null` (a stored null makes `exists` match all)
 *  - prune empty objects
 *  - keys are master-data Codes, never display names
 *  - counts are numbers, so gte/between work
 */
export type CoolerDocument = {
  coolers?: Partial<Record<CoolerTypeKey, Record<string, Record<string, true>>>>;
  shared_coolers?: { notes?: string; selected?: Record<string, true> };
  cold_vaults?: {
    no_of_cold_vault?: number;
    no_of_carb_doors?: number;
    no_of_non_carb_doors?: number;
  };
};

/** One editable cooler row in the UI. */
export type CoolerRow = { coolerType: CoolerTypeKey; brand: string; package: string };

export type CustomerVendorSelectionItem = {
  vendorId: number;
  name: string;
  code: string;
  groupName: string;
  isSelected: boolean;
  accountNumber?: string | null;
};

export type CustomerVendorSelectionGroup = {
  groupName: string;
  groupOrder: number;
  vendors: CustomerVendorSelectionItem[];
};

export type CustomerStatus = "Active" | "Pending" | "Inactive";

export type Customer = {
  id: number;
  memberId: string;
  contactName: string;
  personTitle?: string | null;
  businessName?: string | null;
  corpName?: string | null;
  salesTaxId?: string | null;
  federalTaxId?: string | null;
  storePhone?: string | null;
  storeFax?: string | null;
  cellPhone?: string | null;
  email?: string | null;
  storeAddress?: string | null;
  storeCity?: string | null;
  storeState?: string | null;
  storeZipcode?: string | null;
  district?: string | null;
  region?: string | null;
  mailingAddress?: string | null;
  mailingCity?: string | null;
  mailingState?: string | null;
  mailingZipcode?: string | null;
  storeGroup?: string | null;
  status: CustomerStatus;
  dateJoined: string;
  dateInactive?: string | null;
  inactiveReason?: string | null;
  reinstated?: string | null;
  zoneNo?: string | null;
  zoneManager?: string | null;
  signedBy?: string | null;
  comments?: string | null;
  createdOn?: string | null;
  createdBy?: string | null;
  modifiedOn?: string | null;
  modifiedBy?: string | null;
};

// A customer activity/log entry (CustomerLog).
export type CustomerLog = {
  id: number;
  customerId: number;
  message: string;
  createdOn: string;
  createdBy: string;
  modifiedOn?: string | null;
  modifiedBy?: string | null;
};

// Equipment/footprint metadata stored as JSON alongside a customer (StoreMetadata).
export type StoreMetadata = {
  id: number;
  customerId: number;
  jsonData: string;
  createdOn: string;
  createdBy: string;
  modifiedBy?: string | null;
};

// --- Reporting ---
export type ReportVisualization = "table" | "bar" | "pie" | "metric";

export type ReportFilterRow = { field: string; operator: string; value: string };

export type ReportSource = "customers" | "customer-vendor";

// The report definition is stored inside ReportPreset.queryParameters (JSON).
export type ReportDefinition = {
  source?: ReportSource; // defaults to "customers"
  filters?: string[]; // "field|operator|value"
  metadataFilters?: string[];
  columns?: string[];
  sortField?: string;
  ascending?: boolean;
  visualization?: ReportVisualization;
  groupBy?: string;
  series?: string; // secondary group for stacked bar charts
  aggregate?: string; // "count"
  pinnedToDashboard?: boolean;
  dashboardSize?: "small" | "large"; // widget width on the dashboard
  emailRecipients?: string[];
  emailFrequency?: "none" | "daily" | "weekly";
  // customer-vendor source: which vendors to match and whether all (AND) or any (OR).
  // Comma-separated strings to match the API's ReportPresetQueryParameters model
  // (so saved presets also drive the API's presetId merge).
  vendorCodes?: string;
  vendorGroupNames?: string;
  matchAll?: boolean;
};

export type ReportPreset = {
  id: number;
  name: string;
  description?: string | null;
  queryParameters: ReportDefinition;
  createdOn: string;
  createdBy: string;
  modifiedOn?: string | null;
};

export type AggregateBucket = { key: string; count: number };
export type Bucket2d = { key: string; series: AggregateBucket[] };

// --- Customer ↔ Vendor report source ---
// A vendor as returned by /api/vendors/grouped (the picker data).
export type VendorSummary = {
  id: number;
  name: string;
  code: string;
  groupName: string;
  groupOrder: number;
  displayOrder: number;
  isActive: boolean;
};

export type VendorGroup = {
  groupName: string;
  groupOrder: number;
  vendors: VendorSummary[];
};

// A vendor selected by a customer, in the vendor report rows.
export type VendorReportVendor = {
  vendorId: number;
  name: string;
  code: string;
  groupName: string;
  groupOrder: number;
  displayOrder: number;
  accountNumber?: string | null;
  jsonData?: string | null;
};

// One row of the customer-vendor report: a customer + their selected vendors.
export type VendorReportItem = {
  customerId: number;
  memberId: string;
  contactName: string;
  businessName?: string | null;
  storeCity?: string | null;
  storeState?: string | null;
  status: CustomerStatus;
  selectedVendors: VendorReportVendor[];
};

// The .NET API returns the items as a JSON array and pagination metadata in the
// X-Pagination response header.
export type PageInfo = {
  PageIndex: number;
  PageSize: number;
  TotalCount: number;
  TotalPages: number;
  HasPreviousPage: boolean;
  HasNextPage: boolean;
};
