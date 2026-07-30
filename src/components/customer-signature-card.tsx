"use client";

/* eslint-disable @next/next/no-img-element */
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Pencil, X } from "lucide-react";
import { saveCustomerSignature } from "@/app/(app)/customers/onboard/actions";
import { SignaturePad } from "@/components/signature-pad";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useCan } from "@/components/permissions-provider";

/**
 * The customer's signature-on-file. Shown in the eSignature tab; it pre-fills the signature field
 * on any document later sent to this customer (handled server-side). Editable when permitted.
 */
export function CustomerSignatureCard({
  customerId,
  initialSignature,
}: {
  customerId: number;
  initialSignature: string | null;
}) {
  const canEdit = useCan("customer_data:update");
  const [signature, setSignature] = useState(initialSignature);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [, startTransition] = useTransition();

  function save(dataUrl: string) {
    setSaving(true);
    startTransition(async () => {
      const res = await saveCustomerSignature(customerId, dataUrl);
      setSaving(false);
      if (res.ok) {
        setSignature(dataUrl);
        setEditing(false);
        toast.success("Signature saved.");
      } else {
        toast.error(res.error ?? "Could not save the signature.");
      }
    });
  }

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <CardTitle className="text-base">Signature on file</CardTitle>
        {canEdit &&
          (editing ? (
            <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>
              <X /> Cancel
            </Button>
          ) : (
            <Button size="sm" variant="outline" onClick={() => setEditing(true)}>
              <Pencil /> {signature ? "Re-capture" : "Capture"}
            </Button>
          ))}
      </CardHeader>
      <CardContent>
        {editing ? (
          <SignaturePad onSave={save} saving={saving} initialDataUrl={signature} saved={!!signature} />
        ) : signature ? (
          <div className="inline-block rounded-md border bg-white p-2">
            <img src={signature} alt="Customer signature" className="h-24 w-auto" />
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            No signature captured. It pre-fills the signature field on documents you send this
            customer.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
