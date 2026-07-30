"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { setSetting } from "@/app/(app)/settings/system/actions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

const AUTO_APPROVE_KEY = "AutoGenerateMemberIdOnApproval";

export function SystemSettingsManager({
  autoGenerateMemberIdOnApproval,
}: {
  autoGenerateMemberIdOnApproval: boolean;
}) {
  const [on, setOn] = useState(autoGenerateMemberIdOnApproval);
  const [pending, startTransition] = useTransition();

  function toggle() {
    const next = !on;
    setOn(next); // optimistic
    startTransition(async () => {
      const res = await setSetting(AUTO_APPROVE_KEY, next ? "true" : "false");
      if (!res.ok) {
        setOn(!next); // revert
        toast.error(res.error ?? "Failed to save the setting.");
      } else {
        toast.success(next ? "New members now require approval." : "New members are now created directly.");
      }
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Member onboarding</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1">
            <p className="text-sm font-medium">Require approval before assigning a member ID</p>
            <p className="text-xs text-muted-foreground">
              When on, a new member is created as <span className="font-medium">Pending</span> with no
              MA number and enters the approval queue. An owner or admin approves it, which generates
              the MA number and activates the member. When off, the MA number is assigned as soon as
              the member is submitted.
            </p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={on}
            aria-label="Require approval before assigning a member ID"
            disabled={pending}
            onClick={toggle}
            className={cn(
              "relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full transition-colors focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none",
              on ? "bg-primary" : "bg-input",
              pending && "opacity-60",
            )}
          >
            <span
              className={cn(
                "inline-block size-5 transform rounded-full bg-white shadow transition-transform",
                on ? "translate-x-5" : "translate-x-0.5",
              )}
            />
          </button>
        </div>
        {pending && (
          <p className="mt-3 flex items-center gap-1 text-xs text-muted-foreground">
            <Loader2 className="size-3 animate-spin" /> Saving…
          </p>
        )}
      </CardContent>
    </Card>
  );
}
