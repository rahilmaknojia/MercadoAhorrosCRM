"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { saveReportEmailSettings, sendReportEmailNow } from "@/app/(app)/reports/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Mail, Send } from "lucide-react";

type Frequency = "none" | "daily" | "weekly";
const selectClass =
  "h-9 w-full rounded-md border border-input bg-transparent px-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50";

export function ReportEmailForm({
  reportId,
  initialRecipients,
  initialFrequency,
}: {
  reportId: number;
  initialRecipients: string[];
  initialFrequency: Frequency;
}) {
  const [recipients, setRecipients] = useState(initialRecipients.join(", "));
  const [frequency, setFrequency] = useState<Frequency>(initialFrequency);
  const [saving, startSaving] = useTransition();
  const [sending, startSending] = useTransition();

  return (
    <div className="space-y-3 rounded-lg border p-4">
      <h2 className="flex items-center gap-2 text-sm font-medium">
        <Mail className="size-4" /> Email &amp; schedule
      </h2>
      <div className="grid gap-3 sm:grid-cols-[1fr_160px]">
        <div className="space-y-1">
          <Label htmlFor="recipients">Recipients</Label>
          <Input
            id="recipients"
            value={recipients}
            onChange={(e) => setRecipients(e.target.value)}
            placeholder="a@store.com, b@store.com"
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="freq">Schedule</Label>
          <select
            id="freq"
            className={selectClass}
            value={frequency}
            onChange={(e) => setFrequency(e.target.value as Frequency)}
          >
            <option value="none">Manual only</option>
            <option value="daily">Daily</option>
            <option value="weekly">Weekly</option>
          </select>
        </div>
      </div>
      <div className="flex gap-2">
        <Button
          variant="outline"
          size="sm"
          disabled={saving}
          onClick={() =>
            startSaving(async () => {
              await saveReportEmailSettings(reportId, recipients, frequency);
              toast.success("Schedule saved.");
            })
          }
        >
          {saving && <Loader2 className="animate-spin" />}
          Save schedule
        </Button>
        <Button
          size="sm"
          disabled={sending}
          onClick={() =>
            startSending(async () => {
              const res = await sendReportEmailNow(reportId, recipients);
              if (res.ok) toast.success("Report emailed.");
              else toast.error(res.error ?? "Failed to send.");
            })
          }
        >
          {sending ? <Loader2 className="animate-spin" /> : <Send />}
          Send now
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">
        Recurring delivery runs when a scheduler calls the report; “Send now” emails a summary
        immediately. Requires SES configured on the server.
      </p>
    </div>
  );
}
