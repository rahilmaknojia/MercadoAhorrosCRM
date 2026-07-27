"use client";

import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import { CUSTOMER_FIELDS, COOLER_METADATA_PATHS } from "@/lib/report";
import { cn } from "@/lib/utils";
import { tagBadgeClass } from "@/lib/esign";
import type {
  EsignatureAvailableTemplate,
  EsignatureMergeTokenMapping,
  EsignatureRoleMapping,
  EsignatureTemplate,
  EsignatureTemplateMapping,
  VendorGroup,
} from "@/lib/types";
import {
  createEsignatureTemplate,
  deleteEsignatureTemplate,
  getAvailableTemplateDetail,
  getAvailableTemplates,
  updateEsignatureTemplate,
} from "@/app/(app)/settings/esignature/actions";
import { useCan } from "@/components/permissions-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Pencil, Plus, Trash2 } from "lucide-react";

const selectClass =
  "h-9 rounded-md border border-input bg-transparent px-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50";

type Editor = {
  mode: "add" | "edit";
  id?: number;
  externalTemplateId: string;
  name: string;
  description: string;
  tag: string;
  isActive: boolean;
  roles: EsignatureRoleMapping[];
  tokens: EsignatureMergeTokenMapping[];
};

function parseMapping(json: string): EsignatureTemplateMapping {
  try {
    const m = JSON.parse(json) as EsignatureTemplateMapping;
    return { roles: m.roles ?? [], mergeTokens: m.mergeTokens ?? [] };
  } catch {
    return { roles: [], mergeTokens: [] };
  }
}

export function EsignatureTemplateManager({
  templates,
  vendorGroups,
}: {
  templates: EsignatureTemplate[];
  vendorGroups: VendorGroup[];
}) {
  const canManage = useCan("esignature_templates:manage");
  const [editor, setEditor] = useState<Editor | null>(null);
  const [available, setAvailable] = useState<EsignatureAvailableTemplate[] | null>(null);
  const [pending, startTransition] = useTransition();

  const vendors = useMemo(
    () => vendorGroups.flatMap((g) => g.vendors.map((v) => ({ code: v.code, name: v.name, group: g.groupName }))),
    [vendorGroups]
  );

  function openAdd() {
    startTransition(async () => {
      const res = await getAvailableTemplates();
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      setAvailable(res.data ?? []);
      setEditor({
        mode: "add",
        externalTemplateId: "",
        name: "",
        description: "",
        tag: "",
        isActive: true,
        roles: [],
        tokens: [],
      });
    });
  }

  function pickAvailable(externalId: string) {
    if (!externalId) {
      setEditor((e) => (e ? { ...e, externalTemplateId: "", roles: [], tokens: [] } : e));
      return;
    }
    startTransition(async () => {
      const res = await getAvailableTemplateDetail(externalId);
      if (!res.ok || !res.data) {
        toast.error(res.error ?? "Could not load template.");
        return;
      }
      const detail = res.data;
      let firstDynamicUsed = false;
      const roles: EsignatureRoleMapping[] = (detail.roles ?? []).map((r) => {
        const hasPreset = Boolean(r.presetEmail || r.presetName);
        let source: EsignatureRoleMapping["source"] = "preset";
        if (!hasPreset && !firstDynamicUsed) {
          source = "customer";
          firstDynamicUsed = true;
        } else if (!hasPreset) {
          source = "manual";
        }
        return {
          roleKey: r.key,
          label: r.label,
          source,
          emailField: source === "customer" ? "email" : undefined,
          nameField: source === "customer" ? "contactName" : undefined,
        };
      });
      const tokens: EsignatureMergeTokenMapping[] = (detail.mergeTokens ?? []).map((t) => ({
        token: t,
        source: "literal",
        value: "",
      }));
      setEditor((e) =>
        e
          ? { ...e, externalTemplateId: externalId, name: e.name || detail.name || externalId, roles, tokens }
          : e
      );
    });
  }

  function openEdit(t: EsignatureTemplate) {
    const mapping = parseMapping(t.mappingJson);
    setAvailable(null);
    setEditor({
      mode: "edit",
      id: t.id,
      externalTemplateId: t.externalTemplateId,
      name: t.name,
      description: t.description ?? "",
      tag: t.tag ?? "",
      isActive: t.isActive,
      roles: mapping.roles,
      tokens: mapping.mergeTokens,
    });
  }

  function save() {
    if (!editor) return;
    if (!editor.externalTemplateId) return toast.error("Pick a NinjaFlow template first.");
    if (!editor.name.trim()) return toast.error("Name is required.");
    const mapping: EsignatureTemplateMapping = { roles: editor.roles, mergeTokens: editor.tokens };
    startTransition(async () => {
      const res =
        editor.mode === "add"
          ? await createEsignatureTemplate({
              externalTemplateId: editor.externalTemplateId,
              name: editor.name.trim(),
              description: editor.description || null,
              tag: editor.tag.trim() || null,
              isActive: editor.isActive,
              mapping,
            })
          : await updateEsignatureTemplate(editor.id!, {
              name: editor.name.trim(),
              description: editor.description || null,
              tag: editor.tag.trim() || null,
              isActive: editor.isActive,
              mapping,
            });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(editor.mode === "add" ? "Template onboarded." : "Template updated.");
      setEditor(null);
    });
  }

  function remove(t: EsignatureTemplate) {
    if (!confirm(`Remove "${t.name}"? Existing signed documents are kept.`)) return;
    startTransition(async () => {
      const res = await deleteEsignatureTemplate(t.id);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success("Template removed.");
    });
  }

  const patchRole = (i: number, next: Partial<EsignatureRoleMapping>) =>
    setEditor((e) => (e ? { ...e, roles: e.roles.map((r, idx) => (idx === i ? { ...r, ...next } : r)) } : e));
  const patchToken = (i: number, next: Partial<EsignatureMergeTokenMapping>) =>
    setEditor((e) => (e ? { ...e, tokens: e.tokens.map((t, idx) => (idx === i ? { ...t, ...next } : t)) } : e));

  return (
    <div className="space-y-4">
      {canManage && !editor && (
        <Button onClick={openAdd} disabled={pending} className="gap-2">
          {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
          Onboard template
        </Button>
      )}

      {editor ? (
        <Card>
          <CardHeader>
            <CardTitle>{editor.mode === "add" ? "Onboard a template" : `Edit ${editor.name}`}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            {editor.mode === "add" && (
              <div className="space-y-1">
                <label className="text-xs font-medium">NinjaFlow template</label>
                <select
                  className={`${selectClass} w-full`}
                  value={editor.externalTemplateId}
                  onChange={(e) => pickAvailable(e.target.value)}
                >
                  <option value="">Select a template…</option>
                  {(available ?? []).map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name ?? t.id}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <label className="text-xs font-medium">Display name</label>
                <Input value={editor.name} onChange={(e) => setEditor({ ...editor, name: e.target.value })} />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium">Description</label>
                <Input
                  value={editor.description}
                  onChange={(e) => setEditor({ ...editor, description: e.target.value })}
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium">Tag</label>
                <Input
                  placeholder="e.g. Coke contract"
                  value={editor.tag}
                  onChange={(e) => setEditor({ ...editor, tag: e.target.value })}
                />
                <p className="text-[11px] text-muted-foreground">
                  Categorizes documents from this template; one tag per template.
                </p>
              </div>
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={editor.isActive}
                onChange={(e) => setEditor({ ...editor, isActive: e.target.checked })}
              />
              Active (offered on customer pages)
            </label>

            {/* Roles */}
            {editor.roles.length > 0 && (
              <div className="space-y-2">
                <h3 className="text-sm font-semibold">Signers</h3>
                {editor.roles.map((role, i) => (
                  <div key={role.roleKey} className="rounded-md border p-3 space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-medium">{role.label || role.roleKey}</span>
                      <span className="text-xs text-muted-foreground">({role.roleKey})</span>
                      <select
                        className={`${selectClass} ml-auto`}
                        value={role.source}
                        onChange={(e) => patchRole(i, { source: e.target.value as EsignatureRoleMapping["source"] })}
                      >
                        <option value="customer">From customer record</option>
                        <option value="preset">NinjaFlow preset</option>
                        <option value="manual">Entered when sending</option>
                      </select>
                    </div>
                    {role.source === "customer" && (
                      <div className="grid gap-2 sm:grid-cols-3">
                        <FieldSelect
                          label="Email field"
                          value={role.emailField ?? "email"}
                          onChange={(v) => patchRole(i, { emailField: v })}
                        />
                        <FieldSelect
                          label="Name field"
                          value={role.nameField ?? "contactName"}
                          onChange={(v) => patchRole(i, { nameField: v })}
                        />
                        <FieldSelect
                          label="Phone field (optional)"
                          value={role.phoneField ?? ""}
                          onChange={(v) => patchRole(i, { phoneField: v || undefined })}
                          allowNone
                        />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Merge tokens */}
            {editor.tokens.length > 0 && (
              <div className="space-y-2">
                <h3 className="text-sm font-semibold">Merge fields</h3>
                {editor.tokens.map((token, i) => (
                  <div key={token.token} className="rounded-md border p-3 space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <code className="text-sm">{token.token}</code>
                      <select
                        className={`${selectClass} ml-auto`}
                        value={token.source}
                        onChange={(e) =>
                          patchToken(i, { source: e.target.value as EsignatureMergeTokenMapping["source"] })
                        }
                      >
                        <option value="customer">Customer field</option>
                        <option value="vendor">Vendor account</option>
                        <option value="storeMetadata">Store metadata</option>
                        <option value="literal">Fixed text</option>
                      </select>
                    </div>
                    {token.source === "customer" && (
                      <FieldSelect
                        label="Field"
                        value={token.field ?? ""}
                        onChange={(v) => patchToken(i, { field: v })}
                        allowNone
                      />
                    )}
                    {token.source === "vendor" && (
                      <div className="grid gap-2 sm:grid-cols-2">
                        <div className="space-y-1">
                          <label className="text-xs font-medium">Vendor</label>
                          <select
                            className={`${selectClass} w-full`}
                            value={token.vendorCode ?? ""}
                            onChange={(e) => patchToken(i, { vendorCode: e.target.value })}
                          >
                            <option value="">Select…</option>
                            {vendors.map((v) => (
                              <option key={v.code} value={v.code}>
                                {v.name} ({v.group})
                              </option>
                            ))}
                          </select>
                        </div>
                        <div className="space-y-1">
                          <label className="text-xs font-medium">Property</label>
                          <Input
                            placeholder="accountNumber"
                            value={token.property ?? ""}
                            onChange={(e) => patchToken(i, { property: e.target.value })}
                          />
                        </div>
                      </div>
                    )}
                    {token.source === "storeMetadata" && (
                      <div className="space-y-1">
                        <label className="text-xs font-medium">Metadata path</label>
                        <Input
                          list="esign-metadata-paths"
                          placeholder="gas.brand"
                          value={token.path ?? ""}
                          onChange={(e) => patchToken(i, { path: e.target.value })}
                        />
                      </div>
                    )}
                    {token.source === "literal" && (
                      <Input
                        placeholder="Fixed value"
                        value={token.value ?? ""}
                        onChange={(e) => patchToken(i, { value: e.target.value })}
                      />
                    )}
                  </div>
                ))}
                <datalist id="esign-metadata-paths">
                  {COOLER_METADATA_PATHS.map((p) => (
                    <option key={p.value} value={p.value}>
                      {p.label}
                    </option>
                  ))}
                </datalist>
              </div>
            )}

            <div className="flex gap-2">
              <Button onClick={save} disabled={pending} className="gap-2">
                {pending && <Loader2 className="h-4 w-4 animate-spin" />}
                Save
              </Button>
              <Button variant="ghost" onClick={() => setEditor(null)} disabled={pending}>
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {templates.length === 0 ? (
            <p className="text-sm text-muted-foreground">No templates onboarded yet.</p>
          ) : (
            templates.map((t) => (
              <div key={t.id} className="flex items-center gap-3 rounded-md border p-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="truncate text-sm font-medium">{t.name}</span>
                    {t.tag && (
                      <span className={cn("rounded-full px-2 py-0.5 text-xs font-medium", tagBadgeClass(t.tag))}>
                        {t.tag}
                      </span>
                    )}
                    {!t.isActive && <Badge variant="secondary">Inactive</Badge>}
                  </div>
                  <div className="truncate text-xs text-muted-foreground">{t.externalTemplateId}</div>
                </div>
                {canManage && (
                  <div className="ml-auto flex gap-1">
                    <Button variant="ghost" size="sm" onClick={() => openEdit(t)} className="gap-1">
                      <Pencil className="h-3.5 w-3.5" /> Edit
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => remove(t)}
                      className="gap-1 text-destructive"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}

function FieldSelect({
  label,
  value,
  onChange,
  allowNone,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  allowNone?: boolean;
}) {
  return (
    <div className="space-y-1">
      <label className="text-xs font-medium">{label}</label>
      <select className={`${selectClass} w-full`} value={value} onChange={(e) => onChange(e.target.value)}>
        {allowNone && <option value="">None</option>}
        {CUSTOMER_FIELDS.map((f) => (
          <option key={f.value} value={f.value}>
            {f.label}
          </option>
        ))}
      </select>
    </div>
  );
}
