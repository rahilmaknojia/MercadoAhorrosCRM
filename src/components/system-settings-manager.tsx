"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { setSetting } from "@/app/(app)/settings/system/actions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

const AUTO_APPROVE_KEY = "AutoGenerateMemberIdOnApproval";
const OFFLINE_APP_PIN_KEY = "OfflineAppPinAllowed";

export function SystemSettingsManager({
  autoGenerateMemberIdOnApproval,
  offlineAppPinAllowed,
}: {
  autoGenerateMemberIdOnApproval: boolean;
  offlineAppPinAllowed: boolean;
}) {
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Member onboarding</CardTitle>
        </CardHeader>
        <CardContent>
          <SettingSwitch
            settingKey={AUTO_APPROVE_KEY}
            initial={autoGenerateMemberIdOnApproval}
            label="Require approval before assigning a member ID"
            onMessage="New members now require approval."
            offMessage="New members are now created directly."
          >
            When on, a new member is created as <span className="font-medium">Pending</span> with no
            MA number and enters the approval queue. An owner or admin approves it, which generates
            the MA number and activates the member. When off, the MA number is assigned as soon as
            the member is submitted.
          </SettingSwitch>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Mobile offline access</CardTitle>
        </CardHeader>
        <CardContent>
          <SettingSwitch
            settingKey={OFFLINE_APP_PIN_KEY}
            initial={offlineAppPinAllowed}
            label="Allow an app PIN on devices without a screen lock"
            onMessage="Reps without a screen lock can now set an app PIN for offline use."
            offMessage="Offline access now requires a device screen lock."
          >
            The mobile app opens offline only after the rep unlocks the device (Face ID, fingerprint,
            PIN or pattern). When on, a rep whose device has no screen lock can set a 4–6 digit app
            PIN instead; five wrong tries turn it off until they sign in online. When off, those reps
            must add a screen lock to their device to work offline.
          </SettingSwitch>
        </CardContent>
      </Card>
    </div>
  );
}

/** One owner setting stored as "true"/"false", saved as soon as it is flipped. */
function SettingSwitch({
  settingKey,
  initial,
  label,
  onMessage,
  offMessage,
  children,
}: {
  settingKey: string;
  initial: boolean;
  label: string;
  onMessage: string;
  offMessage: string;
  children: React.ReactNode;
}) {
  const [on, setOn] = useState(initial);
  const [pending, startTransition] = useTransition();

  function toggle() {
    const next = !on;
    setOn(next); // optimistic
    startTransition(async () => {
      const res = await setSetting(settingKey, next ? "true" : "false");
      if (!res.ok) {
        setOn(!next); // revert
        toast.error(res.error ?? "Failed to save the setting.");
      } else {
        toast.success(next ? onMessage : offMessage);
      }
    });
  }

  return (
    <>
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <p className="text-sm font-medium">{label}</p>
          <p className="text-xs text-muted-foreground">{children}</p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={on}
          aria-label={label}
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
    </>
  );
}
