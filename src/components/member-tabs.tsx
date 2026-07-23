"use client";

import { useState, type ReactNode } from "react";
import { Tabs, TabsIndicator, TabsList, TabsPanel, TabsTab } from "@/components/ui/tabs";

type TabDef = { value: string; label: string; count?: number; content: ReactNode };

/**
 * The member page's tab shell.
 *
 * Client-side only because tab selection is interactive, but the panels are passed in as
 * already-rendered server content, so every tab's data is still fetched on the server in one
 * pass. All panels are mounted at once (Base UI keeps hidden panels in the DOM), which means
 * switching tabs is instant and Ctrl+F still finds everything on the page.
 *
 * The active tab is mirrored to a `?tab=` query param so a refresh or a shared link lands on the
 * same tab: the server reads the param and hands it back as `initialTab`, and each switch rewrites
 * the URL with history.replaceState — no navigation, so the server panels are never re-fetched.
 */
export function MemberTabs({ tabs, initialTab }: { tabs: TabDef[]; initialTab?: string }) {
  const defaultTab = tabs[0]?.value;
  const [active, setActive] = useState(
    tabs.some((t) => t.value === initialTab) ? initialTab! : defaultTab
  );

  function selectTab(value: string) {
    setActive(value);
    const url = new URL(window.location.href);
    // Keep the default tab's URL clean (no param); only pin the non-default tabs.
    if (value === defaultTab) url.searchParams.delete("tab");
    else url.searchParams.set("tab", value);
    window.history.replaceState(window.history.state, "", url);
  }

  return (
    <Tabs value={active} onValueChange={(value) => selectTab(String(value))}>
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
