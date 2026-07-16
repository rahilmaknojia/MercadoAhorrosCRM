"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";

type Labels = Record<string, string>;

const BreadcrumbContext = createContext<{
  labels: Labels;
  setLabel: (href: string, label: string) => void;
} | null>(null);

/**
 * Lets a detail page tell the breadcrumb what a dynamic segment's friendly name is (e.g.
 * /customers/1 -> "Herrera Superette"), keyed by the crumb's href. Wraps the shell so both the
 * top-bar breadcrumb and the page content share it.
 */
export function BreadcrumbProvider({ children }: { children: React.ReactNode }) {
  const [labels, setLabels] = useState<Labels>({});
  const setLabel = useCallback((href: string, label: string) => {
    setLabels((prev) => (prev[href] === label ? prev : { ...prev, [href]: label }));
  }, []);
  return (
    <BreadcrumbContext.Provider value={{ labels, setLabel }}>{children}</BreadcrumbContext.Provider>
  );
}

export function useBreadcrumbLabels(): Labels {
  return useContext(BreadcrumbContext)?.labels ?? {};
}

/** Rendered by a detail page to register a friendly label for its href. Renders nothing. */
export function BreadcrumbLabel({ href, label }: { href: string; label: string }) {
  const ctx = useContext(BreadcrumbContext);
  useEffect(() => {
    if (label) ctx?.setLabel(href, label);
  }, [ctx, href, label]);
  return null;
}
