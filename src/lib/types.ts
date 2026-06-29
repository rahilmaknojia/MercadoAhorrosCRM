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

export type CustomerStatus = "Active" | "Pending" | "Inactive";

export type Customer = {
  id: number;
  memberId: string;
  contactName: string;
  businessName?: string | null;
  corpName?: string | null;
  email?: string | null;
  storePhone?: string | null;
  cellPhone?: string | null;
  storeAddress?: string | null;
  storeCity?: string | null;
  storeState?: string | null;
  storeZipcode?: string | null;
  status: CustomerStatus;
  dateJoined: string;
  zoneManager?: string | null;
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
