"use client";

import { createContext, useContext } from "react";
import type { Permissions } from "@/lib/types";

const PermissionsContext = createContext<Permissions>({
  userId: null,
  email: null,
  roles: [],
  permissions: [],
});

export function PermissionsProvider({
  value,
  children,
}: {
  value: Permissions;
  children: React.ReactNode;
}) {
  return <PermissionsContext.Provider value={value}>{children}</PermissionsContext.Provider>;
}

export function usePermissions() {
  return useContext(PermissionsContext);
}

export function useCan(permission: string) {
  return useContext(PermissionsContext).permissions.includes(permission);
}

/** Render children only if the current user holds the permission. UX only — the API still enforces. */
export function Can({ permission, children }: { permission: string; children: React.ReactNode }) {
  return useCan(permission) ? <>{children}</> : null;
}
