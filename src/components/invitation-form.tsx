"use client";

import { useActionState, useEffect, useRef } from "react";
import { inviteEmail, type InviteState } from "@/app/(app)/settings/users/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, UserPlus } from "lucide-react";

export function InvitationForm() {
  const [state, action, pending] = useActionState<InviteState, FormData>(inviteEmail, {});
  const formRef = useRef<HTMLFormElement>(null);

  // Clear the field after a successful invite.
  useEffect(() => {
    if (state.success) formRef.current?.reset();
  }, [state.success]);

  return (
    <form ref={formRef} action={action} className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <Input
          name="email"
          type="email"
          placeholder="person@example.com"
          required
          className="max-w-xs"
        />
        <Button type="submit" disabled={pending}>
          {pending ? <Loader2 className="animate-spin" /> : <UserPlus />}
          Invite
        </Button>
      </div>
      {state.error && <p className="text-sm text-destructive">{state.error}</p>}
      {state.success && <p className="text-sm text-emerald-600">{state.success}</p>}
    </form>
  );
}
