"use client";

import type { ReactNode } from "react";
import { Tabs, TabsIndicator, TabsList, TabsPanel, TabsTab } from "@/components/ui/tabs";

type TabDef = { value: string; label: string; count?: number; content: ReactNode };

/**
 * The member page's tab shell.
 *
 * Client-side only because tab selection is interactive, but the panels are passed in as
 * already-rendered server content, so every tab's data is still fetched on the server in one
 * pass. All panels are mounted at once (Base UI keeps hidden panels in the DOM), which means
 * switching tabs is instant and Ctrl+F still finds everything on the page.
 */
export function MemberTabs({ tabs }: { tabs: TabDef[] }) {
  return (
    <Tabs defaultValue={tabs[0]?.value}>
      <TabsList>
        {tabs.map((tab) => (
          <TabsTab key={tab.value} value={tab.value}>
            {tab.label}
            {tab.count !== undefined && (
              <span className="rounded-full bg-muted px-1.5 py-0.5 text-xs tabular-nums text-muted-foreground">
                {tab.count}
              </span>
            )}
          </TabsTab>
        ))}
        <TabsIndicator />
      </TabsList>

      {tabs.map((tab) => (
        <TabsPanel key={tab.value} value={tab.value} className="space-y-4">
          {tab.content}
        </TabsPanel>
      ))}
    </Tabs>
  );
}
