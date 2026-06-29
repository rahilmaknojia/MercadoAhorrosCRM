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

const PRIVILEGED_ROLES = new Set(["owner", "admin"]);

/** True for Owner/Admin — who may manage the invitation allowlist (the auth service enforces). */
export function useIsPrivileged() {
  const { roles } = useContext(PermissionsContext);
  return roles
    .flatMap((r) => r.split(","))
    .some((r) => PRIVILEGED_ROLES.has(r.trim().toLowerCase()));
}

/** Render children only for Owner/Admin. UX gating only — the auth service still enforces. */
export function RequirePrivileged({ children }: { children: React.ReactNode }) {
  return useIsPrivileged() ? <>{children}</> : null;
}
