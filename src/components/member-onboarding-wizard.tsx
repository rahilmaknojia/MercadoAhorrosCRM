"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Check, ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import {
  createOnboardingMember,
  fetchVendorGroups,
  saveCustomerSignature,
  type OnboardingMemberInput,
} from "@/app/(app)/customers/onboard/actions";
import { CustomerVendors } from "@/components/customer-vendors";
import { CustomerPhotos } from "@/components/customer-photos";
import { SignaturePad } from "@/components/signature-pad";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import type { CustomerVendorSelectionGroup } from "@/lib/types";

const STEPS = ["Member", "Store", "Vendors", "Photos", "Signature"] as const;

const selectClass =
  "flex h-9 w-full rounded-md border border-input bg-transparent px-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50";

export function MemberOnboardingWizard({
  suggestions,
  requiresApproval,
}: {
  suggestions: Record<string, string[]>;
  requiresApproval: boolean;
}) {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [form, setForm] = useState<OnboardingMemberInput>({ contactName: "", status: "Pending" });
  const [created, setCreated] = useState<{ id: number; memberId: string | null } | null>(null);
  const [vendorGroups, setVendorGroups] = useState<CustomerVendorSelectionGroup[]>([]);
  const [signatureSaved, setSignatureSaved] = useState(false);
  const [savingSig, setSavingSig] = useState(false);
  const [pending, startTransition] = useTransition();

  const set = (patch: Partial<OnboardingMemberInput>) => setForm((f) => ({ ...f, ...patch }));
  const minStep = created ? 2 : 0; // once created, member/store steps lock

  function goNext() {
    if (step === 0) {
      if (!form.contactName.trim()) {
        toast.error("Contact name is required.");
        return;
      }
      setStep(1);
      return;
    }

    if (step === 1) {
      if (created) {
        setStep(2);
        return;
      }
      startTransition(async () => {
        const res = await createOnboardingMember(form);
        if (!res.ok) {
          toast.error(res.error);
          return;
        }
        setCreated(res.data);
        const groups = await fetchVendorGroups(res.data.id);
        if (groups.ok) setVendorGroups(groups.data);
        toast.success(
          res.data.memberId
            ? `Member ${res.data.memberId} created`
            : "Member created — awaiting approval",
        );
        setStep(2);
      });
      return;
    }

    if (step < STEPS.length - 1) {
      setStep(step + 1);
      return;
    }

    // Finish.
    if (created?.memberId) {
      toast.success("Onboarding complete.");
      router.push(`/customers/${created.id}`);
    } else {
      toast.success("Submitted for approval.");
      router.push("/customers/approvals");
    }
  }

  function handleSaveSignature(dataUrl: string) {
    if (!created) return;
    setSavingSig(true);
    startTransition(async () => {
      const res = await saveCustomerSignature(created.id, dataUrl);
      setSavingSig(false);
      if (res.ok) {
        setSignatureSaved(true);
        toast.success("Signature saved.");
      } else {
        toast.error(res.error ?? "Could not save the signature.");
      }
    });
  }

  const isLast = step === STEPS.length - 1;

  return (
    <div className="space-y-6">
      <Stepper current={step} />

      <div className="min-h-[18rem]">
        {step === 0 && <MemberStep form={form} set={set} disabled={!!created} />}
        {step === 1 && <StoreStep form={form} set={set} suggestions={suggestions} disabled={!!created} />}
        {step === 2 &&
          (created ? (
            <OptionalSection
              title="Vendor accounts"
              hint="Select the vendors this store carries and record their account numbers. Optional — you can skip and add these later."
            >
              {vendorGroups.length > 0 ? (
                <CustomerVendors customerId={created.id} groups={vendorGroups} />
              ) : (
                <p className="text-sm text-muted-foreground">No vendor catalogue is available.</p>
              )}
            </OptionalSection>
          ) : (
            <CreatingNotice />
          ))}
        {step === 3 &&
          (created ? (
            <OptionalSection
              title="Photos"
              hint="Upload storefront, shelf, or document photos. Optional."
            >
              {created.memberId ? (
                <CustomerPhotos memberId={created.memberId} customerId={created.id} />
              ) : (
                <div className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                  Photos can be added once this member is approved — the MA number (used to file
                  photos) is assigned on approval. Approve the member, then add photos from its
                  Photos tab.
                </div>
              )}
            </OptionalSection>
          ) : (
            <CreatingNotice />
          ))}
        {step === 4 &&
          (created ? (
            <OptionalSection
              title="Customer signature"
              hint="Have the customer sign below. The signature is kept on file and pre-fills the signature field on any document you later send them for signing."
            >
              <SignaturePad onSave={handleSaveSignature} saving={savingSig} saved={signatureSaved} />
            </OptionalSection>
          ) : (
            <CreatingNotice />
          ))}
      </div>

      <div className="flex items-center justify-between border-t pt-4">
        <Button
          type="button"
          variant="outline"
          onClick={() => setStep((s) => Math.max(minStep, s - 1))}
          disabled={step <= minStep || pending}
        >
          <ChevronLeft className="size-4" /> Back
        </Button>

        <div className="flex items-center gap-2">
          {step >= 2 && !isLast && (
            <span className="text-xs text-muted-foreground">Optional step</span>
          )}
          <Button type="button" onClick={goNext} disabled={pending}>
            {pending && <Loader2 className="size-4 animate-spin" />}
            {step === 1 && !created
              ? requiresApproval
                ? "Create & continue"
                : "Create & continue"
              : isLast
                ? requiresApproval
                  ? "Finish & submit for approval"
                  : "Finish"
                : "Next"}
            {!isLast && <ChevronRight className="size-4" />}
          </Button>
        </div>
      </div>
    </div>
  );
}

function Stepper({ current }: { current: number }) {
  return (
    <ol className="flex items-center">
      {STEPS.map((label, i) => {
        const done = i < current;
        const active = i === current;
        return (
          <li key={label} className={cn("flex items-center", i < STEPS.length - 1 && "flex-1")}>
            <div className="flex flex-col items-center gap-1">
              <div
                className={cn(
                  "flex size-8 items-center justify-center rounded-full border text-sm font-semibold transition-colors",
                  done && "border-primary bg-primary text-primary-foreground",
                  active && "border-primary text-primary",
                  !done && !active && "border-input text-muted-foreground",
                )}
              >
                {done ? <Check className="size-4" /> : i + 1}
              </div>
              <span
                className={cn(
                  "text-[11px] font-medium",
                  active ? "text-foreground" : "text-muted-foreground",
                )}
              >
                {label}
              </span>
            </div>
            {i < STEPS.length - 1 && (
              <div className={cn("mx-2 h-0.5 flex-1 rounded-full", done ? "bg-primary" : "bg-input")} />
            )}
          </li>
        );
      })}
    </ol>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
  required = false,
  disabled = false,
}: {
  label: string;
  value?: string;
  onChange: (v: string) => void;
  type?: string;
  required?: boolean;
  disabled?: boolean;
}) {
  return (
    <div className="space-y-1">
      <Label>
        {label}
        {required && <span className="text-destructive"> *</span>}
      </Label>
      <Input
        type={type}
        value={value ?? ""}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}

function SelectField({
  label,
  value,
  options,
  onChange,
  disabled,
}: {
  label: string;
  value?: string;
  options: string[];
  onChange: (v: string) => void;
  disabled?: boolean;
}) {
  const known = !value || options.includes(value);
  return (
    <div className="space-y-1">
      <Label>{label}</Label>
      <select
        className={selectClass}
        value={value ?? ""}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
      >
        <option value="">—</option>
        {!known && value && <option value={value}>{value}</option>}
        {options.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
    </div>
  );
}

function MemberStep({
  form,
  set,
  disabled,
}: {
  form: OnboardingMemberInput;
  set: (p: Partial<OnboardingMemberInput>) => void;
  disabled: boolean;
}) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Field label="Contact name" required value={form.contactName} onChange={(v) => set({ contactName: v })} disabled={disabled} />
      <Field label="Title" value={form.personTitle} onChange={(v) => set({ personTitle: v })} disabled={disabled} />
      <Field label="Business name" value={form.businessName} onChange={(v) => set({ businessName: v })} disabled={disabled} />
      <Field label="Corporate name" value={form.corpName} onChange={(v) => set({ corpName: v })} disabled={disabled} />
      <Field label="Email" type="email" value={form.email} onChange={(v) => set({ email: v })} disabled={disabled} />
      <Field label="Store phone" value={form.storePhone} onChange={(v) => set({ storePhone: v })} disabled={disabled} />
      <Field label="Cell phone" value={form.cellPhone} onChange={(v) => set({ cellPhone: v })} disabled={disabled} />
      <Field label="Fax" value={form.storeFax} onChange={(v) => set({ storeFax: v })} disabled={disabled} />
    </div>
  );
}

function StoreStep({
  form,
  set,
  suggestions,
  disabled,
}: {
  form: OnboardingMemberInput;
  set: (p: Partial<OnboardingMemberInput>) => void;
  suggestions: Record<string, string[]>;
  disabled: boolean;
}) {
  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Street address" value={form.storeAddress} onChange={(v) => set({ storeAddress: v })} disabled={disabled} />
        <Field label="City" value={form.storeCity} onChange={(v) => set({ storeCity: v })} disabled={disabled} />
        <Field label="State" value={form.storeState} onChange={(v) => set({ storeState: v })} disabled={disabled} />
        <Field label="ZIP code" value={form.storeZipcode} onChange={(v) => set({ storeZipcode: v })} disabled={disabled} />
      </div>
      <p className="text-xs font-medium text-muted-foreground">Mailing address</p>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Mailing address" value={form.mailingAddress} onChange={(v) => set({ mailingAddress: v })} disabled={disabled} />
        <Field label="Mailing city" value={form.mailingCity} onChange={(v) => set({ mailingCity: v })} disabled={disabled} />
        <Field label="Mailing state" value={form.mailingState} onChange={(v) => set({ mailingState: v })} disabled={disabled} />
        <Field label="Mailing ZIP" value={form.mailingZipcode} onChange={(v) => set({ mailingZipcode: v })} disabled={disabled} />
      </div>
      <p className="text-xs font-medium text-muted-foreground">Territory</p>
      <div className="grid gap-4 sm:grid-cols-2">
        <SelectField label="Region" value={form.region} options={suggestions.region ?? []} onChange={(v) => set({ region: v })} disabled={disabled} />
        <SelectField label="District" value={form.district} options={suggestions.district ?? []} onChange={(v) => set({ district: v })} disabled={disabled} />
        <SelectField label="Zone no." value={form.zoneNo} options={suggestions.zoneNo ?? []} onChange={(v) => set({ zoneNo: v })} disabled={disabled} />
        <SelectField label="Zone manager" value={form.zoneManager} options={suggestions.zoneManager ?? []} onChange={(v) => set({ zoneManager: v })} disabled={disabled} />
        <SelectField label="Store group" value={form.storeGroup} options={suggestions.storeGroup ?? []} onChange={(v) => set({ storeGroup: v })} disabled={disabled} />
      </div>
      <p className="text-xs font-medium text-muted-foreground">Identifiers &amp; status</p>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Sales tax ID" value={form.salesTaxId} onChange={(v) => set({ salesTaxId: v })} disabled={disabled} />
        <Field label="Federal tax ID" value={form.federalTaxId} onChange={(v) => set({ federalTaxId: v })} disabled={disabled} />
        <div className="space-y-1">
          <Label>Status</Label>
          <select
            className={selectClass}
            value={form.status ?? "Pending"}
            disabled={disabled}
            onChange={(e) => set({ status: e.target.value })}
          >
            <option value="Active">Active</option>
            <option value="Pending">Pending</option>
            <option value="Inactive">Inactive</option>
          </select>
        </div>
      </div>
    </div>
  );
}

function OptionalSection({
  title,
  hint,
  children,
}: {
  title: string;
  hint: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-3">
      <div>
        <h2 className="text-lg font-semibold">{title}</h2>
        <p className="text-sm text-muted-foreground">{hint}</p>
      </div>
      {children}
    </div>
  );
}

function CreatingNotice() {
  return (
    <div className="flex items-center gap-2 text-sm text-muted-foreground">
      <Loader2 className="size-4 animate-spin" /> Creating the member…
    </div>
  );
}
