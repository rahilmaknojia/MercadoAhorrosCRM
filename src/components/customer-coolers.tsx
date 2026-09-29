"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Info, Loader2, Pencil, Plus, Save, Send, Trash2, X } from "lucide-react";
import {
  discardSiteSurveyDraft,
  getSiteSurvey,
  saveSiteSurveyDraft,
  submitSiteSurvey,
} from "@/app/(app)/customers/[id]/site-survey-actions";
import { useCan } from "@/components/permissions-provider";
import { StatusPill } from "@/components/site-survey/compliance/status-pill";
import { SurveyHistory, SurveyVersionDialog, versionByline } from "@/components/site-survey/coolers/survey-history";
import {
  AlertDialog,
  AlertDialogClose,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  CATEGORY_FIELDS,
  coldVaultTotal,
  DOOR_FIELDS,
  fieldId,
  formatCount,
  formatSurveyDate,
  fromForm,
  labelOf,
  SHELF_FIELDS,
  SPACE_PAYMENT_OPTIONS,
  toForm,
  YES_FLAGS,
  type NumberField,
  type SurveyForm,
  type SurveyOverview,
} from "@/lib/site-survey";
import { COOLER_TYPES, type CoolerRow, type CoolerTypeKey, type MasterDataItem } from "@/lib/types";

const selectClass =
  "h-9 w-full rounded-md border border-input bg-transparent px-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50";

type Busy = "draft" | "submit" | "discard" | null;

/**
 * Site Survey → Coolers & Cold Vaults: the store's cooler footprint as a versioned survey.
 *
 * Draft → Submit, like the compliance review. Edit starts from the open draft (or what is on file),
 * "Save draft" keeps work in progress without touching the member's data, and "Submit" freezes a
 * new version and applies it to the member (reports, filters and eSignature read the applied
 * values). Every version stays in the history with who/when and what changed.
 */
export function CustomerCoolers({
  customerId,
  initial,
  initialError,
  brands,
  packages,
  sharedCoolers,
}: {
  customerId: number;
  initial: SurveyOverview | null;
  initialError: string | null;
  brands: MasterDataItem[];
  packages: MasterDataItem[];
  sharedCoolers: MasterDataItem[];
}) {
  const canEdit = useCan("customer_data:update");
  const [overview, setOverview] = useState<SurveyOverview | null>(initial);
  const [loadError, setLoadError] = useState<string | null>(initialError);
  const [form, setForm] = useState<SurveyForm>(() => toForm(initial?.draft?.survey ?? initial?.live ?? {}));
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState<Busy>(null);
  const [retrying, startRetry] = useTransition();
  const [confirm, setConfirm] = useState<"submit" | "discard" | null>(null);
  const [openVersion, setOpenVersion] = useState<number | null>(null);

  const catalogues = { brands, packages, sharedCoolers };

  if (!overview) {
    return (
      <Card>
        <CardContent className="flex flex-wrap items-center justify-between gap-3 py-6 text-sm">
          <span className="text-destructive">{loadError ?? "Could not load the site survey."}</span>
          <Button
            size="sm"
            variant="outline"
            disabled={retrying}
            onClick={() =>
              startRetry(async () => {
                const res = await getSiteSurvey(customerId);
                if (res.ok) apply(res.data);
                else setLoadError(res.error);
              })
            }
          >
            {retrying && <Loader2 className="animate-spin" />} Retry
          </Button>
        </CardContent>
      </Card>
    );
  }

  const draft = overview.draft;
  const shown = editing ? form : toForm(draft?.survey ?? overview.live);
  const latestSubmitted = overview.history.find((e) => e.status === "submitted");
  const pending = busy !== null;

  /** Adopt a fresh overview from the server and show its draft (or what is on file). */
  function apply(next: SurveyOverview) {
    setOverview(next);
    setLoadError(null);
    setForm(toForm(next.draft?.survey ?? next.live));
  }

  function startEditing() {
    setForm(toForm(draft?.survey ?? overview!.live));
    setEditing(true);
  }

  function handleConflict(res: { error: string; conflict?: SurveyOverview }) {
    toast.error(res.error);
    if (res.conflict) {
      apply(res.conflict);
      setEditing(false);
    }
  }

  async function saveDraft() {
    const built = fromForm(form);
    if ("errors" in built) return void toast.error(built.errors.join(" "));
    setBusy("draft");
    const res = await saveSiteSurveyDraft(customerId, overview!.headVersion, built.survey);
    setBusy(null);
    if (!res.ok) return handleConflict(res);
    const refreshed = await getSiteSurvey(customerId);
    if (refreshed.ok) setOverview(refreshed.data);
    setEditing(false);
    toast.success(`Draft v${res.data.summary.version} saved.`);
  }

  async function submit() {
    const built = fromForm(form);
    if ("errors" in built) {
      setConfirm(null);
      return void toast.error(built.errors.join(" "));
    }
    setBusy("submit");
    const res = await submitSiteSurvey(customerId, overview!.headVersion, built.survey);
    setBusy(null);
    setConfirm(null);
    if (!res.ok) return handleConflict(res);
    const refreshed = await getSiteSurvey(customerId);
    if (refreshed.ok) apply(refreshed.data);
    setEditing(false);
    toast.success(`Site survey v${res.data.summary.version} submitted.`);
  }

  async function discard() {
    setBusy("discard");
    const res = await discardSiteSurveyDraft(customerId, overview!.headVersion);
    setBusy(null);
    setConfirm(null);
    if (!res.ok) return handleConflict(res);
    apply(res.data);
    setEditing(false);
    toast.success("Draft discarded.");
  }

  const nextVersion = draft?.summary.version ?? (overview.headVersion ?? 0) + 1;
  const total = coldVaultTotal(shown);
  const setNumber = (id: string, value: string) => setForm((f) => ({ ...f, numbers: { ...f.numbers, [id]: value } }));

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3 space-y-0">
          <div className="space-y-1">
            <CardTitle className="text-base">Coolers &amp; cold vaults</CardTitle>
            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              {draft ? (
                <>
                  <StatusPill status="draft" version={draft.summary.version} />
                  <span>{versionByline(draft.summary)} · not yet applied to the member</span>
                </>
              ) : latestSubmitted ? (
                <>
                  <StatusPill status="submitted" version={latestSubmitted.version} />
                  <span>{versionByline(latestSubmitted)}</span>
                </>
              ) : (
                <span>Not surveyed yet{shown.rows.length || total !== undefined ? " — showing data on file" : ""}</span>
              )}
            </div>
          </div>
          {canEdit &&
            (editing ? (
              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="ghost" onClick={() => setEditing(false)} disabled={pending}>
                  <X /> Cancel
                </Button>
                <Button size="sm" variant="outline" onClick={() => void saveDraft()} disabled={pending}>
                  {busy === "draft" ? <Loader2 className="animate-spin" /> : <Save />} Save draft
                </Button>
                <Button size="sm" onClick={() => setConfirm("submit")} disabled={pending}>
                  <Send /> Submit
                </Button>
              </div>
            ) : (
              <div className="flex flex-wrap gap-2">
                {draft && (
                  <Button size="sm" variant="ghost" onClick={() => setConfirm("discard")} disabled={pending}>
                    <Trash2 /> Discard draft
                  </Button>
                )}
                <Button size="sm" variant="outline" onClick={startEditing} disabled={pending}>
                  <Pencil /> {draft ? "Continue draft" : "Edit"}
                </Button>
              </div>
            ))}
        </CardHeader>

        <CardContent className="space-y-5">
          {/* ---- coolers ---- */}
          {COOLER_TYPES.map(({ key, label }) => {
            const typeRows = shown.rows.filter((r) => r.coolerType === key);
            return (
              <Row key={key} title={label}>
                {editing ? (
                  <div className="space-y-1.5">
                    {typeRows.map((row, i) => (
                      <div key={`${key}-${i}`} className="grid grid-cols-[1fr_1fr_auto] items-center gap-2">
                        <CatalogueSelect
                          value={row.brand}
                          items={brands}
                          disabled={pending}
                          ariaLabel={`${label} brand`}
                          onChange={(v) => updateRow(setForm, key, i, { brand: v })}
                        />
                        <CatalogueSelect
                          value={row.package}
                          items={packages}
                          disabled={pending}
                          ariaLabel={`${label} package`}
                          onChange={(v) => updateRow(setForm, key, i, { package: v })}
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          aria-label={`Remove ${label} row`}
                          disabled={pending}
                          onClick={() => removeRow(setForm, key, i)}
                        >
                          <Trash2 />
                        </Button>
                      </div>
                    ))}
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      disabled={pending}
                      onClick={() =>
                        setForm((f) => ({
                          ...f,
                          rows: [...f.rows, { coolerType: key, brand: brands[0]?.code ?? "", package: packages[0]?.code ?? "" }],
                        }))
                      }
                    >
                      <Plus /> Add
                    </Button>
                  </div>
                ) : typeRows.length === 0 ? (
                  <Empty />
                ) : (
                  <div className="flex flex-wrap gap-1.5">
                    {typeRows.map((row, i) => (
                      <span
                        key={`${key}-${i}`}
                        className="inline-flex items-center gap-1 rounded-full border border-border bg-muted/50 px-2.5 py-0.5 text-xs font-medium"
                      >
                        {labelOf(brands, row.brand)}
                        <span className="text-muted-foreground">·</span>
                        <span className="text-muted-foreground">{labelOf(packages, row.package)}</span>
                      </span>
                    ))}
                  </div>
                )}
              </Row>
            );
          })}

          {/* ---- shared coolers ---- */}
          <Row title="Shared coolers" divided>
            {editing ? (
              <div className="space-y-2">
                <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 md:grid-cols-3">
                  {sharedCoolers.map((item) => (
                    <label key={item.id} className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        className="size-4"
                        checked={form.sharedSelected.includes(item.code)}
                        disabled={pending}
                        onChange={(e) =>
                          setForm((f) => ({
                            ...f,
                            sharedSelected: e.target.checked
                              ? [...new Set([...f.sharedSelected, item.code])]
                              : f.sharedSelected.filter((c) => c !== item.code),
                          }))
                        }
                      />
                      <span className="truncate">{item.name}</span>
                    </label>
                  ))}
                </div>
                <Input
                  value={form.sharedNotes}
                  onChange={(e) => setForm((f) => ({ ...f, sharedNotes: e.target.value }))}
                  disabled={pending}
                  placeholder="Notes, e.g. Coke + Pepsi share the end cap"
                />
              </div>
            ) : shown.sharedSelected.length === 0 && !shown.sharedNotes ? (
              <Empty />
            ) : (
              <div className="space-y-1.5">
                <div className="flex flex-wrap gap-1.5">
                  {shown.sharedSelected.map((code) => (
                    <span
                      key={code}
                      className="inline-flex items-center rounded-full border border-border bg-muted/50 px-2.5 py-0.5 text-xs font-medium"
                    >
                      {labelOf(sharedCoolers, code)}
                    </span>
                  ))}
                </div>
                {shown.sharedNotes && <p className="text-sm text-muted-foreground">{shown.sharedNotes}</p>}
              </div>
            )}
          </Row>

          {/* ---- cold vaults ---- */}
          <Row title="Cold vaults" divided>
            <FieldGrid>
              <ReadOnlyField
                label="Cooler Modified On"
                value={formatSurveyDate(overview.coolerModifiedOn)}
                hint="Set automatically when a submitted survey changes the cold vault, shelf, facing or store fields."
              />
              <ReadOnlyField
                label="# of Cold Vault Doors"
                value={formatCount(total)}
                hint="Calculated: Carb + Non-Carb + Store Options + Beer doors."
              />
              {DOOR_FIELDS.map((f) => (
                <NumberInput key={fieldId(f)} field={f} form={shown} editing={editing} disabled={pending} onChange={setNumber} />
              ))}
            </FieldGrid>
          </Row>

          {/* ---- shelves & facings ---- */}
          <Row title="Shelves & facings" divided>
            <FieldGrid>
              {SHELF_FIELDS.map((f) => (
                <NumberInput key={fieldId(f)} field={f} form={shown} editing={editing} disabled={pending} onChange={setNumber} />
              ))}
            </FieldGrid>
          </Row>

          {/* ---- store ---- */}
          <Row title="Store" divided>
            <FieldGrid>
              {YES_FLAGS.map(({ key, label }) =>
                editing ? (
                  <label key={key} className="flex items-center gap-2 self-end pb-2 text-sm">
                    <input
                      type="checkbox"
                      className="size-4"
                      checked={form.flags[key]}
                      disabled={pending}
                      onChange={(e) => setForm((f) => ({ ...f, flags: { ...f.flags, [key]: e.target.checked } }))}
                    />
                    {label}
                  </label>
                ) : (
                  <ReadOnlyField key={key} label={label} value={shown.flags[key] ? "Yes" : ""} />
                )
              )}
              {editing ? (
                <div className="space-y-1">
                  <Label htmlFor="space_payment_eligible">Space Payment Eligible</Label>
                  <select
                    id="space_payment_eligible"
                    className={selectClass}
                    value={form.spacePayment}
                    disabled={pending}
                    onChange={(e) => setForm((f) => ({ ...f, spacePayment: e.target.value }))}
                  >
                    <option value="">—</option>
                    {SPACE_PAYMENT_OPTIONS.map((o) => (
                      <option key={o} value={o}>
                        {o}
                      </option>
                    ))}
                  </select>
                </div>
              ) : (
                <ReadOnlyField label="Space Payment Eligible" value={shown.spacePayment} />
              )}
            </FieldGrid>
          </Row>

          {/* ---- shelves by category ---- */}
          <Row title="Shelves by category" divided>
            <FieldGrid>
              {CATEGORY_FIELDS.map((f) => (
                <NumberInput key={fieldId(f)} field={f} form={shown} editing={editing} disabled={pending} onChange={setNumber} />
              ))}
            </FieldGrid>
          </Row>
        </CardContent>
      </Card>

      <SurveyHistory entries={overview.history} onOpen={setOpenVersion} />
      <SurveyVersionDialog
        customerId={customerId}
        version={openVersion}
        previousVersion={
          openVersion === null ? null : (overview.history.find((e) => e.version < openVersion)?.version ?? null)
        }
        catalogues={catalogues}
        onClose={() => setOpenVersion(null)}
      />

      <AlertDialog open={confirm === "submit"} onOpenChange={(o) => busy !== "submit" && setConfirm(o ? "submit" : null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Submit site survey v{nextVersion}?</AlertDialogTitle>
            <AlertDialogDescription>
              This saves a new version to the history and updates the member&apos;s cooler and cold vault data.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogClose render={<Button variant="ghost" disabled={busy === "submit"} />}>Keep editing</AlertDialogClose>
            <Button onClick={() => void submit()} disabled={busy === "submit"}>
              {busy === "submit" ? <Loader2 className="animate-spin" /> : <Send />} Submit
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={confirm === "discard"} onOpenChange={(o) => busy !== "discard" && setConfirm(o ? "discard" : null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Discard this draft?</AlertDialogTitle>
            <AlertDialogDescription>
              The draft&apos;s changes are deleted. The member&apos;s data on file is not affected.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogClose render={<Button variant="ghost" disabled={busy === "discard"} />}>Keep draft</AlertDialogClose>
            <Button variant="destructive" onClick={() => void discard()} disabled={busy === "discard"}>
              {busy === "discard" ? <Loader2 className="animate-spin" /> : <Trash2 />} Discard
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function Row({ title, divided, children }: { title: string; divided?: boolean; children: React.ReactNode }) {
  return (
    <div className={`grid gap-2 sm:grid-cols-[160px_1fr] ${divided ? "border-t border-border pt-4" : ""}`}>
      <h3 className="text-sm font-medium text-muted-foreground">{title}</h3>
      <div>{children}</div>
    </div>
  );
}

function FieldGrid({ children }: { children: React.ReactNode }) {
  return <div className="grid gap-x-4 gap-y-3 sm:grid-cols-2 lg:grid-cols-3">{children}</div>;
}

function Empty() {
  return <p className="text-sm text-muted-foreground">—</p>;
}

function HintIcon({ hint }: { hint: string }) {
  return (
    <span title={hint} aria-label={hint} className="inline-flex cursor-help text-muted-foreground">
      <Info className="size-3.5" />
    </span>
  );
}

function ReadOnlyField({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="space-y-1">
      <div className="flex items-center gap-1 text-xs text-muted-foreground">
        {label}
        {hint && <HintIcon hint={hint} />}
      </div>
      <div className="text-sm font-medium tabular-nums">{value || "—"}</div>
    </div>
  );
}

function NumberInput({
  field,
  form,
  editing,
  disabled,
  onChange,
}: {
  field: NumberField;
  form: SurveyForm;
  editing: boolean;
  disabled: boolean;
  onChange: (id: string, value: string) => void;
}) {
  const id = fieldId(field);
  if (!editing) return <ReadOnlyField label={field.label} value={form.numbers[id] ?? ""} hint={field.hint} />;
  return (
    <div className="space-y-1">
      <Label htmlFor={id} className="flex items-center gap-1">
        {field.label}
        {field.hint && <HintIcon hint={field.hint} />}
      </Label>
      <Input
        id={id}
        type="number"
        min={0}
        step={field.whole ? 1 : 0.01}
        inputMode={field.whole ? "numeric" : "decimal"}
        value={form.numbers[id] ?? ""}
        disabled={disabled}
        onChange={(e) => onChange(id, e.target.value)}
      />
    </div>
  );
}

/** Rows are stored flat across cooler types, so edits address the Nth row *within* a type. */
function updateRow(
  setForm: React.Dispatch<React.SetStateAction<SurveyForm>>,
  type: CoolerTypeKey,
  indexWithinType: number,
  patch: Partial<CoolerRow>
) {
  setForm((f) => {
    let seen = -1;
    return {
      ...f,
      rows: f.rows.map((r) => {
        if (r.coolerType !== type) return r;
        seen += 1;
        return seen === indexWithinType ? { ...r, ...patch } : r;
      }),
    };
  });
}

function removeRow(
  setForm: React.Dispatch<React.SetStateAction<SurveyForm>>,
  type: CoolerTypeKey,
  indexWithinType: number
) {
  setForm((f) => {
    let seen = -1;
    return {
      ...f,
      rows: f.rows.filter((r) => {
        if (r.coolerType !== type) return true;
        seen += 1;
        return seen !== indexWithinType;
      }),
    };
  });
}

/**
 * A catalogue dropdown keyed by Code. Keeps the current value selectable even if the item was
 * disabled or removed from the catalogue, so editing one row never silently rewrites another.
 */
function CatalogueSelect({
  value,
  items,
  disabled,
  ariaLabel,
  onChange,
}: {
  value: string;
  items: MasterDataItem[];
  disabled: boolean;
  ariaLabel: string;
  onChange: (value: string) => void;
}) {
  const known = items.some((i) => i.code === value);
  return (
    <select
      className={selectClass}
      value={value}
      disabled={disabled}
      aria-label={ariaLabel}
      onChange={(e) => onChange(e.target.value)}
    >
      {!known && <option value={value}>{value || "Select…"}</option>}
      {items.map((item) => (
        <option key={item.id} value={item.code}>
          {item.name}
        </option>
      ))}
    </select>
  );
}
