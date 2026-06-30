"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { MASTER_DATA_TYPES, type MasterDataItem } from "@/lib/types";
import {
  createMasterDataItem,
  deleteMasterDataItem,
  mergeMasterDataItem,
  updateMasterDataItem,
} from "@/app/(app)/settings/master-data/actions";
import { useCan } from "@/components/permissions-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, Plus, Trash2 } from "lucide-react";

const selectClass =
  "h-9 rounded-md border border-input bg-transparent px-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50";

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
          items.map((item) => (
            <Row key={item.id} item={item} siblings={items} canManage={canManage} label={label} />
          ))
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
  siblings,
  canManage,
  label,
}: {
  item: MasterDataItem;
  siblings: MasterDataItem[];
  canManage: boolean;
  label: string;
}) {
  const [name, setName] = useState(item.name);
  const [pending, start] = useTransition();
  const dirty = name.trim() !== item.name && name.trim().length > 0;

  function rename() {
    if (!dirty) return;
    start(async () => {
      const r = await updateMasterDataItem({ ...item, name: name.trim() });
      if (r.ok) toast.success("Renamed (linked customers updated).");
      else {
        toast.error(r.error ?? "Failed to rename.");
        setName(item.name);
      }
    });
  }
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
  function merge(targetId: number) {
    start(async () => {
      const r = await mergeMasterDataItem(item.id, targetId);
      if (r.ok) toast.success("Merged.");
      else toast.error(r.error ?? "Failed to merge.");
    });
  }

  const mergeTargets = siblings.filter((s) => s.id !== item.id);

  if (!canManage) {
    return (
      <div className="px-3 py-2 text-sm">
        <span className={item.isActive ? "" : "text-muted-foreground line-through"}>{item.name}</span>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2 px-3 py-2 text-sm">
      <Input
        value={name}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            rename();
          }
        }}
        className={`h-9 max-w-[16rem] flex-1 ${item.isActive ? "" : "text-muted-foreground line-through"}`}
        disabled={pending}
      />
      {dirty && (
        <Button size="sm" onClick={rename} disabled={pending}>
          {pending ? <Loader2 className="animate-spin" /> : null} Save
        </Button>
      )}
      <Button size="sm" variant="ghost" onClick={toggleActive} disabled={pending}>
        {item.isActive ? "Disable" : "Enable"}
      </Button>
      {mergeTargets.length > 0 && (
        <select
          aria-label="Merge into"
          className={selectClass}
          value=""
          disabled={pending}
          onChange={(e) => {
            const target = Number(e.target.value);
            if (target) merge(target);
            e.target.value = "";
          }}
        >
          <option value="">Merge into…</option>
          {mergeTargets.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
      )}
      <Button size="sm" variant="ghost" onClick={remove} disabled={pending} aria-label="Delete">
        <Trash2 className="size-4" />
      </Button>
    </div>
  );
}
