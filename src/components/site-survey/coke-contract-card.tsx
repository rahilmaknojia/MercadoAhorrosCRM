"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import {
  Check,
  CupSoda,
  Droplets,
  FileSignature,
  Loader2,
  Minus,
  Package,
  Pencil,
  Plus,
  Save,
  ShoppingBasket,
  Snowflake,
  Wine,
  X,
  type LucideIcon,
} from "lucide-react";
import { saveCokeContract } from "@/app/(app)/customers/[id]/coke-contract-actions";
import { useCan } from "@/components/permissions-provider";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  COKE_DISPLAYS,
  COKE_RACKS,
  fromCokeContract,
  summarizeCokeContract,
  type CokeContractInput,
  type CokeDisplayKey,
  type CokeRackKey,
} from "@/lib/metadata/coke-contract";
import { cn } from "@/lib/utils";

const DISPLAY_ICONS: Record<CokeDisplayKey, LucideIcon> = {
  twelve_pack_display: Package,
  two_liter_display: CupSoda,
  glass_bottle_single_import_rack: Wine,
  topo_chico_take_home_display: ShoppingBasket,
  hydration_rack_or_display: Droplets,
  cold_equipment: Snowflake,
};

/** The Coke contract (spec §1): six display toggles and ten A–J rack counts. */
export function CokeContractCard({ customerId, contract }: { customerId: number; contract: unknown }) {
  const canEdit = useCan("customer_data:update");
  const [pending, startTransition] = useTransition();
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState<CokeContractInput>(() => fromCokeContract(contract));

  const setDisplay = (key: CokeDisplayKey, on: boolean) =>
    setValue((v) => ({ ...v, displays: { ...v.displays, [key]: on } }));
  const setRack = (key: CokeRackKey, raw: string) =>
    setValue((v) => ({ ...v, racks: { ...v.racks, [key]: raw } }));

  function save() {
    startTransition(async () => {
      const res = await saveCokeContract(customerId, value);
      if (res.ok) {
        toast.success("Coke contract saved.");
        setEditing(false);
      } else {
        toast.error(res.error ?? "Failed to save the Coke contract.");
      }
    });
  }

  function cancel() {
    setValue(fromCokeContract(contract));
    setEditing(false);
  }

  const setDisplays = COKE_DISPLAYS.filter(({ key }) => value.displays[key]);
  const setRacks = COKE_RACKS.filter(({ key }) => (value.racks[key] ?? "").trim() !== "");
  const isEmpty = setDisplays.length === 0 && setRacks.length === 0;

  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2 space-y-0">
        <div className="flex min-w-0 items-center gap-2">
          <span className="inline-flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <FileSignature className="size-4" />
          </span>
          <div className="min-w-0 space-y-0.5">
            <CardTitle className="text-base">Coke contract</CardTitle>
            <p className="text-xs text-muted-foreground">{summarizeCokeContract(value)}</p>
          </div>
        </div>
        {canEdit &&
          (editing ? (
            <div className="flex gap-2">
              <Button size="sm" variant="ghost" onClick={cancel} disabled={pending}>
                <X /> Cancel
              </Button>
              <Button size="sm" onClick={save} disabled={pending}>
                {pending ? <Loader2 className="animate-spin" /> : <Save />} Save
              </Button>
            </div>
          ) : (
            !isEmpty && (
              <Button size="sm" variant="outline" onClick={() => setEditing(true)}>
                <Pencil /> Edit
              </Button>
            )
          ))}
      </CardHeader>

      <CardContent className="space-y-6">
        {!editing && isEmpty ? (
          <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed px-4 py-10 text-center">
            <span className="inline-flex size-10 items-center justify-center rounded-full bg-muted text-muted-foreground">
              <FileSignature className="size-5" />
            </span>
            <div className="space-y-1">
              <p className="text-sm font-medium">No Coke contract recorded</p>
              <p className="text-sm text-muted-foreground">
                Record which Coke displays the store has and how many racks it holds.
              </p>
            </div>
            {canEdit && (
              <Button size="sm" onClick={() => setEditing(true)}>
                <Plus /> Record contract
              </Button>
            )}
          </div>
        ) : (
          <>
            <section className="space-y-2">
              <h3 className="text-sm font-medium text-muted-foreground">Displays</h3>
              {editing ? (
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {COKE_DISPLAYS.map((d) => (
                    <DisplayTile
                      key={d.key}
                      icon={DISPLAY_ICONS[d.key]}
                      label={d.label}
                      pressed={!!value.displays[d.key]}
                      stateLabel={"on" in d ? (value.displays[d.key] ? d.on : d.off) : undefined}
                      disabled={pending}
                      onToggle={() => setDisplay(d.key, !value.displays[d.key])}
                    />
                  ))}
                </div>
              ) : setDisplays.length === 0 ? (
                <p className="text-sm text-muted-foreground">No displays recorded.</p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {setDisplays.map((d) => {
                    const Icon = DISPLAY_ICONS[d.key];
                    return (
                      <span
                        key={d.key}
                        className="inline-flex items-center gap-1.5 rounded-full border border-primary/20 bg-primary/5 px-3 py-1 text-sm font-medium"
                      >
                        <Icon className="size-4 text-primary" />
                        {"on" in d ? `${d.label} ${d.on.toLowerCase()}` : d.label}
                      </span>
                    );
                  })}
                </div>
              )}
            </section>

            <section className="space-y-2">
              <h3 className="text-sm font-medium text-muted-foreground">Racks</h3>
              {editing ? (
                <ul className="divide-y rounded-xl border">
                  {COKE_RACKS.map((r) => (
                    <li key={r.key} className="flex flex-wrap items-center gap-x-3 gap-y-2 px-3 py-2.5">
                      <LetterBadge letter={r.letter} />
                      <span className="min-w-0 flex-1 text-sm">{r.label}</span>
                      <Stepper
                        label={`${r.letter}: ${r.label}`}
                        value={value.racks[r.key] ?? ""}
                        disabled={pending}
                        onChange={(raw) => setRack(r.key, raw)}
                      />
                    </li>
                  ))}
                </ul>
              ) : setRacks.length === 0 ? (
                <p className="text-sm text-muted-foreground">No racks recorded.</p>
              ) : (
                <ul className="grid gap-x-6 gap-y-1.5 sm:grid-cols-2">
                  {setRacks.map((r) => (
                    <li key={r.key} className="flex items-center gap-3 text-sm">
                      <LetterBadge letter={r.letter} />
                      <span className="min-w-0 flex-1 truncate text-muted-foreground" title={r.label}>
                        {r.label}
                      </span>
                      <span className="font-semibold tabular-nums">{value.racks[r.key]}</span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </>
        )}
      </CardContent>
    </Card>
  );
}

function DisplayTile({
  icon: Icon,
  label,
  stateLabel,
  pressed,
  disabled,
  onToggle,
}: {
  icon: LucideIcon;
  label: string;
  stateLabel?: string;
  pressed: boolean;
  disabled: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      disabled={disabled}
      onClick={onToggle}
      className={cn(
        "relative flex min-h-24 flex-col items-start justify-between gap-2 rounded-xl border p-3 text-left transition-all outline-none",
        "focus-visible:ring-3 focus-visible:ring-ring/50 active:translate-y-px disabled:opacity-50",
        pressed
          ? "border-primary bg-primary/5 shadow-xs ring-1 ring-primary"
          : "border-border bg-background hover:border-foreground/20 hover:bg-muted/50"
      )}
    >
      <span
        className={cn(
          "inline-flex size-9 items-center justify-center rounded-lg transition-colors",
          pressed ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
        )}
      >
        <Icon className="size-5" />
      </span>
      <span className="text-sm leading-tight font-medium">{label}</span>
      {stateLabel && (
        <span className={cn("text-xs", pressed ? "font-medium text-primary" : "text-muted-foreground")}>
          {stateLabel}
        </span>
      )}
      {pressed && (
        <span className="absolute top-2 right-2 inline-flex size-5 items-center justify-center rounded-full bg-primary text-primary-foreground">
          <Check className="size-3" />
        </span>
      )}
    </button>
  );
}

function LetterBadge({ letter }: { letter: string }) {
  return (
    <span
      className="inline-flex size-6 shrink-0 items-center justify-center rounded-md bg-brand-yellow text-xs font-bold text-brand-yellow-foreground"
      aria-hidden
    >
      {letter}
    </span>
  );
}

/**
 * − / number / + for a count. Blank means "not recorded" (absent in the document); 0 is a real
 * answer. − from 0 clears back to blank; + from blank starts at 1.
 */
function Stepper({
  label,
  value,
  disabled,
  onChange,
}: {
  label: string;
  value: string;
  disabled: boolean;
  onChange: (raw: string) => void;
}) {
  const n = value.trim() === "" ? null : Number(value);
  const valid = n === null || (Number.isInteger(n) && n >= 0);
  const current = n !== null && Number.isFinite(n) ? n : null;

  return (
    <div className="flex items-center">
      <Button
        type="button"
        variant="outline"
        size="icon"
        className="size-9 rounded-r-none"
        aria-label={`Decrease ${label}`}
        title={current === 0 ? "Clear (not recorded)" : "Decrease"}
        disabled={disabled || current === null}
        onClick={() => onChange(current === null || current <= 0 ? "" : String(Math.floor(current) - 1))}
      >
        <Minus />
      </Button>
      <input
        type="number"
        inputMode="numeric"
        min={0}
        step={1}
        value={value}
        placeholder="—"
        aria-label={label}
        aria-invalid={!valid || undefined}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        className={cn(
          "-mx-px h-9 w-14 border border-input bg-transparent text-center text-sm font-semibold tabular-nums outline-none",
          "[appearance:textfield] focus-visible:z-10 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50",
          "[&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none",
          "aria-invalid:border-destructive aria-invalid:text-destructive disabled:opacity-50"
        )}
      />
      <Button
        type="button"
        variant="outline"
        size="icon"
        className="size-9 rounded-l-none"
        aria-label={`Increase ${label}`}
        disabled={disabled}
        onClick={() => onChange(String(current === null ? 1 : Math.floor(current) + 1))}
      >
        <Plus />
      </Button>
    </div>
  );
}
