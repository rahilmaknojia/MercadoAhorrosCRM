"use client";

import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Loader2, Pencil, Trash2 } from "lucide-react";
import {
  reorderEsignatureTemplates,
  updateEsignatureTemplate,
} from "@/app/(app)/settings/esignature/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { sortTemplatesForDisplay, tagBadgeClass } from "@/lib/esign";
import type {
  EsignatureTemplate,
  EsignatureTemplateMapping,
} from "@/lib/types";

/**
 * The onboarded templates in the order customer pages show them: Required (a numbered checklist)
 * first, then Optional. Each section is drag-to-reorder (mouse, touch, or keyboard: focus the
 * handle, Space to lift, arrows to move, Space to drop). The order saves as soon as you drop;
 * "Make required / optional" moves a template between the sections.
 */
export function EsignatureTemplateOrderList({
  templates,
  canManage,
  onEdit,
  onRemove,
}: {
  templates: EsignatureTemplate[];
  canManage: boolean;
  onEdit: (t: EsignatureTemplate) => void;
  onRemove: (t: EsignatureTemplate) => void;
}) {
  // Local copy so a drop reorders instantly; re-synced whenever the server list changes.
  const [items, setItems] = useState(() => sortTemplatesForDisplay(templates));
  useEffect(() => setItems(sortTemplatesForDisplay(templates)), [templates]);
  const [saving, startSaving] = useTransition();
  const [togglingId, setTogglingId] = useState<number | null>(null);

  const required = items.filter((t) => t.isRequired);
  const optional = items.filter((t) => !t.isRequired);

  const sensors = useSensors(
    // A small drag threshold so clicking Edit/Delete on a row never starts a drag.
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  function saveOrder(next: EsignatureTemplate[]) {
    const previous = items;
    setItems(next);
    startSaving(async () => {
      const res = await reorderEsignatureTemplates(next.map((t) => t.id));
      if (!res.ok) {
        setItems(previous);
        toast.error(res.error ?? "Could not save the order.");
        return;
      }
      toast.success("Order saved.");
    });
  }

  // Drops only reorder within a section; required-ness changes via the row toggle.
  function onDragEnd(
    section: EsignatureTemplate[],
    rest: EsignatureTemplate[],
    requiredFirst: boolean,
  ) {
    return (event: DragEndEvent) => {
      const { active, over } = event;
      if (!over || active.id === over.id) return;
      const from = section.findIndex((t) => t.id === active.id);
      const to = section.findIndex((t) => t.id === over.id);
      if (from < 0 || to < 0) return;
      const moved = arrayMove(section, from, to);
      saveOrder(requiredFirst ? [...moved, ...rest] : [...rest, ...moved]);
    };
  }

  function toggleRequired(t: EsignatureTemplate) {
    let mapping: EsignatureTemplateMapping;
    try {
      mapping = JSON.parse(t.mappingJson) as EsignatureTemplateMapping;
    } catch {
      mapping = { roles: [], mergeTokens: [] };
    }
    setTogglingId(t.id);
    startSaving(async () => {
      const res = await updateEsignatureTemplate(t.id, {
        name: t.name,
        description: t.description ?? null,
        tag: t.tag ?? null,
        isActive: t.isActive,
        isRequired: !t.isRequired,
        mapping,
      });
      setTogglingId(null);
      if (!res.ok) {
        toast.error(res.error ?? "Could not update the template.");
        return;
      }
      setItems((prev) =>
        sortTemplatesForDisplay(
          prev.map((x) =>
            x.id === t.id ? { ...x, isRequired: !t.isRequired } : x,
          ),
        ),
      );
      toast.success(
        t.isRequired
          ? `"${t.name}" is now optional.`
          : `"${t.name}" is now required.`,
      );
    });
  }

  if (items.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No templates onboarded yet.
      </p>
    );
  }

  const section = (
    title: string,
    hint: string,
    list: EsignatureTemplate[],
    rest: EsignatureTemplate[],
    requiredFirst: boolean,
  ) => (
    <div className="space-y-2">
      <div className="flex items-baseline gap-2">
        <h2 className="text-sm font-semibold">{title}</h2>
        <span className="text-xs text-muted-foreground">{hint}</span>
        {saving && togglingId === null && (
          <Loader2
            className="ml-auto h-3.5 w-3.5 animate-spin text-muted-foreground"
            aria-label="Saving order"
          />
        )}
      </div>
      {list.length === 0 ? (
        <p className="rounded-md border border-dashed p-3 text-xs text-muted-foreground">
          {requiredFirst
            ? "No required documents. Use “Make required” on a template below."
            : "No optional documents."}
        </p>
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={onDragEnd(list, rest, requiredFirst)}
        >
          <SortableContext
            items={list.map((t) => t.id)}
            strategy={verticalListSortingStrategy}
          >
            <div className="space-y-2">
              {list.map((t, i) => (
                <SortableRow
                  key={t.id}
                  template={t}
                  step={requiredFirst ? i + 1 : null}
                  canManage={canManage}
                  busy={saving}
                  toggling={togglingId === t.id}
                  onEdit={() => onEdit(t)}
                  onRemove={() => onRemove(t)}
                  onToggleRequired={() => toggleRequired(t)}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}
    </div>
  );

  return (
    <div className="space-y-6">
      {section("Required", "Completed in this order", required, optional, true)}
      {section(
        "Optional",
        "Offered after the required documents",
        optional,
        required,
        false,
      )}
    </div>
  );
}

function SortableRow({
  template: t,
  step,
  canManage,
  busy,
  toggling,
  onEdit,
  onRemove,
  onToggleRequired,
}: {
  template: EsignatureTemplate;
  step: number | null;
  canManage: boolean;
  busy: boolean;
  toggling: boolean;
  onEdit: () => void;
  onRemove: () => void;
  onToggleRequired: () => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: t.id, disabled: !canManage });

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(
        "flex items-center gap-3 rounded-md border bg-card p-3",
        isDragging && "relative z-10 shadow-lg ring-2 ring-primary/30",
      )}
    >
      {canManage && (
        <button
          type="button"
          ref={setActivatorNodeRef}
          {...attributes}
          {...listeners}
          aria-label={`Reorder ${t.name}`}
          className="cursor-grab touch-none rounded p-1 text-muted-foreground hover:bg-muted active:cursor-grabbing"
        >
          <GripVertical className="h-4 w-4" />
        </button>
      )}
      {step !== null && (
        <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
          {step}
        </span>
      )}
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <span className="truncate text-sm font-medium">{t.name}</span>
          {t.tag && (
            <span
              className={cn(
                "rounded-full px-2 py-0.5 text-xs font-medium",
                tagBadgeClass(t.tag),
              )}
            >
              {t.tag}
            </span>
          )}
          {!t.isActive && <Badge variant="secondary">Inactive</Badge>}
        </div>
        <div className="truncate text-xs text-muted-foreground">
          {t.externalTemplateId}
        </div>
      </div>
      {canManage && (
        <div className="ml-auto flex shrink-0 items-center gap-1">
          <Button
            variant="outline"
            size="sm"
            onClick={onToggleRequired}
            disabled={busy}
            className="gap-1"
          >
            {toggling && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            {t.isRequired ? "Make optional" : "Make required"}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={onEdit}
            disabled={busy}
            className="gap-1"
          >
            <Pencil className="h-3.5 w-3.5" /> Edit
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={onRemove}
            disabled={busy}
            className="gap-1 text-destructive"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      )}
    </div>
  );
}
