"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { MASTER_DATA_TYPES, type MasterDataItem } from "@/lib/types";
import {
  createMasterDataItem,
  deleteMasterDataItem,
  updateMasterDataItem,
} from "@/app/(app)/settings/master-data/actions";
import { useCan } from "@/components/permissions-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, Plus, Trash2 } from "lucide-react";

export function MasterDataManager({ itemsByType }: { itemsByType: Record<string, MasterDataItem[]> }) {
  const canManage = useCan("master_data:manage");
  return (
    <div className="space-y-8">
      {MASTER_DATA_TYPES.map(({ type, label }) => (
        <TypeSection
          key={type}
          type={type}
          label={label}
          items={itemsByType[type] ?? []}
          canManage={canManage}
        />
      ))}
    </div>
  );
}

function TypeSection({
  type,
  label,
  items,
  canManage,
}: {
  type: string;
  label: string;
  items: MasterDataItem[];
  canManage: boolean;
}) {
  const [name, setName] = useState("");
  const [adding, startAdd] = useTransition();

  function add() {
    if (!name.trim()) return;
    startAdd(async () => {
      const r = await createMasterDataItem(type, name);
      if (r.ok) {
        toast.success(`Added to ${label}.`);
        setName("");
      } else {
        toast.error(r.error ?? "Failed to add.");
      }
    });
  }

  return (
    <section className="space-y-2">
      <h2 className="text-sm font-semibold">
        {label} <span className="font-normal text-muted-foreground">({items.length})</span>
      </h2>
      <div className="divide-y rounded-md border">
        {items.length === 0 ? (
          <p className="p-3 text-sm text-muted-foreground">None yet.</p>
        ) : (
          items.map((item) => <Row key={item.id} item={item} canManage={canManage} label={label} />)
        )}
      </div>
      {canManage && (
        <div className="flex gap-2">
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                add();
              }
            }}
            placeholder={`Add ${label.toLowerCase().replace(/s$/, "")}…`}
            className="h-9 max-w-xs"
            disabled={adding}
          />
          <Button size="sm" onClick={add} disabled={adding || !name.trim()}>
            {adding ? <Loader2 className="animate-spin" /> : <Plus />} Add
          </Button>
        </div>
      )}
    </section>
  );
}

function Row({
  item,
  canManage,
  label,
}: {
  item: MasterDataItem;
  canManage: boolean;
  label: string;
}) {
  const [pending, start] = useTransition();

  function toggleActive() {
    start(async () => {
      const r = await updateMasterDataItem({ ...item, isActive: !item.isActive });
      if (!r.ok) toast.error(r.error ?? "Failed to update.");
    });
  }
  function remove() {
    start(async () => {
      const r = await deleteMasterDataItem(item.id);
      if (r.ok) toast.success(`Removed from ${label}.`);
      else toast.error(r.error ?? "Failed to delete.");
    });
  }

  return (
    <div className="flex items-center justify-between gap-2 px-3 py-2 text-sm">
      <span className={item.isActive ? "" : "text-muted-foreground line-through"}>{item.name}</span>
      {canManage && (
        <div className="flex items-center gap-1">
          <Button size="sm" variant="ghost" onClick={toggleActive} disabled={pending}>
            {item.isActive ? "Disable" : "Enable"}
          </Button>
          <Button size="sm" variant="ghost" onClick={remove} disabled={pending} aria-label="Delete">
            <Trash2 className="size-4" />
          </Button>
        </div>
      )}
    </div>
  );
}
