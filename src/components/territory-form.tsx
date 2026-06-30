"use client";

import { useActionState } from "react";
import Link from "next/link";
import { setTerritory, type TerritoryState } from "@/app/(app)/settings/users/[id]/territory/actions";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";

export function TerritoryForm({
  userId,
  available,
  current,
}: {
  userId: string;
  available: string[];
  current: string[];
}) {
  const action = setTerritory.bind(null, userId);
  const [state, formAction, pending] = useActionState<TerritoryState, FormData>(action, {});

  const currentSet = new Set(current.map((s) => s.toUpperCase()));
  // Union of available states and any already-granted states not in the list.
  const options = Array.from(new Set([...available, ...current].map((s) => s.toUpperCase()))).sort();
  // States granted but not offered as checkboxes go into the custom field.
  const extra = current.filter((s) => !options.includes(s.toUpperCase()));

  return (
    <form action={formAction} className="space-y-6">
      {options.length > 0 ? (
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
          {options.map((s) => (
            <label
              key={s}
              className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm hover:bg-muted/50"
            >
              <input
                type="checkbox"
                name="states"
                value={s}
                defaultChecked={currentSet.has(s)}
                className="size-4"
              />
              {s}
            </label>
          ))}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">
          No states found on existing customers yet. Add them below.
        </p>
      )}

      <div className="space-y-1">
        <Label htmlFor="customStates">Add states (comma-separated)</Label>
        <Input
          id="customStates"
          name="customStates"
          placeholder="e.g. TX, FL, NM"
          defaultValue={extra.join(", ")}
        />
      </div>

      {state.error && <p className="text-sm text-destructive">{state.error}</p>}

      <div className="flex gap-2">
        <Button type="submit" disabled={pending}>
          {pending && <Loader2 className="animate-spin" />}
          Save access
        </Button>
        <Link href="/settings/users" className={buttonVariants({ variant: "outline" })}>
          Cancel
        </Link>
      </div>
    </form>
  );
}
