"use client";

import { useState, type ReactNode } from "react";
import { ClipboardCheck, FileSignature, Refrigerator } from "lucide-react";
import { Tabs, TabsList, TabsPanel, TabsTab } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

export type SiteSurveySub = "coolers" | "coke" | "compliance";

const SUBS: { value: SiteSurveySub; label: string; icon: typeof FileSignature }[] = [
  { value: "coolers", label: "Coolers & Cold Vaults", icon: Refrigerator },
  { value: "coke", label: "Coke Contract", icon: FileSignature },
  { value: "compliance", label: "Compliance Review", icon: ClipboardCheck },
];

/**
 * The Site Survey tab's two sub-tabs, as a segmented control. Mirrors the choice to `?sub=` with
 * history.replaceState — the same approach as MemberTabs' `?tab=`, so a refresh or shared link
 * lands on the same sub-tab without a navigation (which would re-fetch every server panel).
 */
export function SiteSurveyTabs({
  initialSub,
  coolers,
  coke,
  compliance,
  issueCount,
}: {
  initialSub?: string;
  coolers: ReactNode;
  coke: ReactNode;
  compliance: ReactNode;
  /** Shown as a badge on the Compliance sub-tab when the current review flags issues. */
  issueCount?: number;
}) {
  const [active, setActive] = useState<SiteSurveySub>(
    SUBS.some((s) => s.value === initialSub) ? (initialSub as SiteSurveySub) : "coolers"
  );

  function select(value: SiteSurveySub) {
    setActive(value);
    const url = new URL(window.location.href);
    if (value === "coolers") url.searchParams.delete("sub");
    else url.searchParams.set("sub", value);
    window.history.replaceState(window.history.state, "", url);
  }

  return (
    <Tabs value={active} onValueChange={(v) => select(v as SiteSurveySub)}>
      <TabsList className="w-full gap-1 overflow-x-auto rounded-xl border-none bg-muted p-1 sm:w-fit">
        {SUBS.map(({ value, label, icon: Icon }) => (
          <TabsTab
            key={value}
            value={value}
            className={cn(
              "flex-1 justify-center rounded-lg px-3 py-1.5 sm:flex-none",
              "data-[selected]:bg-background data-[selected]:text-foreground data-[selected]:shadow-sm"
            )}
          >
            <Icon className="size-4" />
            {label}
            {value === "compliance" && !!issueCount && (
              <span className="rounded-full bg-destructive/10 px-1.5 py-0.5 text-xs tabular-nums text-destructive">
                {issueCount}
              </span>
            )}
          </TabsTab>
        ))}
      </TabsList>
      <TabsPanel value="coolers" className="space-y-4">
        {coolers}
      </TabsPanel>
      <TabsPanel value="coke" className="space-y-4">
        {coke}
      </TabsPanel>
      <TabsPanel value="compliance" className="space-y-4">
        {compliance}
      </TabsPanel>
    </Tabs>
  );
}
