"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { ArrowRightLeft, Loader2, UserRound } from "lucide-react";
import { linkZoneManagerUser, transferZoneManager } from "@/app/(app)/settings/master-data/actions";
import { useCan } from "@/components/permissions-provider";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import type { AdminUser, MasterDataItem } from "@/lib/types";

const selectClass =
  "h-9 rounded-md border border-input bg-transparent px-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50";

/**
 * Zone-manager extras on a master-data row: which user this zone manager is (so surveys they
 * submit are credited to them), and handing their surveys/members to another zone manager.
 */
export function ZoneManagerControls({
  item,
  siblings,
  users,
  canManage,
}: {
  item: MasterDataItem;
  siblings: MasterDataItem[];
  users: AdminUser[];
  canManage: boolean;
}) {
  const canTransfer = useCan("site_surveys:transfer");
  const [pending, start] = useTransition();
  const [transferOpen, setTransferOpen] = useState(false);

  // Users already linked to another zone manager can't be picked again (one user = one ZM).
  const takenBy = new Map(
    siblings.filter((s) => s.id !== item.id && s.linkedUserId).map((s) => [s.linkedUserId!, s.name])
  );

  function link(userId: string) {
    const user = users.find((u) => u.id === userId);
    start(async () => {
      const r = await linkZoneManagerUser(item.id, user ? { id: user.id, name: user.name, email: user.email } : null);
      if (r.ok) toast.success(user ? `${item.name} is now linked to ${user.name}.` : `${item.name} unlinked.`);
      else toast.error(r.error ?? "Failed to link.");
    });
  }

  const linkedLabel = item.linkedUserId ? item.linkedUserName || item.linkedUserEmail || "Linked user" : null;
  // The linked user may not be in the list (e.g. banned since); keep them selectable.
  const linkedMissing = item.linkedUserId && !users.some((u) => u.id === item.linkedUserId);

  return (
    <div className="flex w-full flex-wrap items-center gap-2 pl-1 text-xs text-muted-foreground">
      <UserRound className="size-3.5" />
      {canManage && users.length > 0 ? (
        <select
          aria-label={`User who is ${item.name}`}
          className={`${selectClass} h-8 text-xs`}
          value={item.linkedUserId ?? ""}
          disabled={pending}
          onChange={(e) => link(e.target.value)}
        >
          <option value="">Not linked to a user</option>
          {linkedMissing && <option value={item.linkedUserId!}>{linkedLabel}</option>}
          {users.map((u) => (
            <option key={u.id} value={u.id} disabled={takenBy.has(u.id)}>
              {u.name} · {u.email}
              {takenBy.has(u.id) ? ` (linked to ${takenBy.get(u.id)})` : ""}
            </option>
          ))}
        </select>
      ) : (
        <span>{linkedLabel ? `Linked to ${linkedLabel}` : "Not linked to a user"}</span>
      )}
      {pending && <Loader2 className="size-3.5 animate-spin" />}
      {canTransfer && siblings.length > 1 && (
        <Button size="sm" variant="ghost" className="h-8 text-xs" onClick={() => setTransferOpen(true)}>
          <ArrowRightLeft /> Transfer…
        </Button>
      )}
      <TransferDialog
        open={transferOpen}
        onOpenChange={setTransferOpen}
        from={item}
        targets={siblings.filter((s) => s.id !== item.id && s.isActive)}
      />
    </div>
  );
}

function TransferDialog({
  open,
  onOpenChange,
  from,
  targets,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  from: MasterDataItem;
  targets: MasterDataItem[];
}) {
  const [to, setTo] = useState("");
  const [surveys, setSurveys] = useState(true);
  const [members, setMembers] = useState(true);
  const [deactivate, setDeactivate] = useState(false);
  const [pending, start] = useTransition();
  const target = targets.find((t) => String(t.id) === to);

  function submit() {
    if (!target) return;
    start(async () => {
      const r = await transferZoneManager(from.id, {
        toZoneManagerId: target.id,
        surveys,
        members,
        deactivateSource: deactivate,
      });
      if (!r.ok || !r.data) {
        toast.error(r.error ?? "Transfer failed.");
        return;
      }
      const parts = [
        surveys && `${r.data.surveysMoved} survey${r.data.surveysMoved === 1 ? "" : "s"}`,
        members && `${r.data.membersMoved} member${r.data.membersMoved === 1 ? "" : "s"}`,
      ].filter(Boolean);
      toast.success(
        `${parts.length ? `Moved ${parts.join(" and ")} from ${from.name} to ${target.name}` : "Done"}` +
          (r.data.sourceDeactivated ? `; ${from.name} deactivated.` : ".")
      );
      onOpenChange(false);
    });
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !pending && onOpenChange(o)}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Transfer from {from.name}</DialogTitle>
          <DialogDescription>
            For when a zone manager is unavailable or has left. Surveys keep who actually submitted them; only
            the zone manager they count for in reports changes.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1">
            <Label htmlFor="transfer-to">Transfer to</Label>
            <select
              id="transfer-to"
              className={`${selectClass} w-full`}
              value={to}
              disabled={pending}
              onChange={(e) => setTo(e.target.value)}
            >
              <option value="">Choose a zone manager…</option>
              {targets.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                  {t.linkedUserName ? ` (${t.linkedUserName})` : ""}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2 text-sm">
            <Check checked={surveys} onChange={setSurveys} disabled={pending}>
              <span className="font-medium">Survey credit</span> — past site surveys count for the new zone manager
            </Check>
            <Check checked={members} onChange={setMembers} disabled={pending}>
              <span className="font-medium">Members</span> — reassign {from.name}&apos;s members (new surveys and
              compliance reviews follow them)
            </Check>
            <Check checked={deactivate} onChange={setDeactivate} disabled={pending}>
              <span className="font-medium">Deactivate {from.name}</span> and unlink their user (they left)
            </Check>
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={pending}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={pending || !target || (!surveys && !members && !deactivate)}>
            {pending ? <Loader2 className="animate-spin" /> : <ArrowRightLeft />} Transfer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Check({
  checked,
  onChange,
  disabled,
  children,
}: {
  checked: boolean;
  onChange: (value: boolean) => void;
  disabled: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="flex items-start gap-2">
      <input
        type="checkbox"
        className="mt-0.5 size-4"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span>{children}</span>
    </label>
  );
}
