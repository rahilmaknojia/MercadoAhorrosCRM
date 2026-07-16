"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatPhone } from "@/lib/utils";

/**
 * A phone field that masks input to `000-000-0000` as the user types (and normalizes an
 * existing value, e.g. a legacy `+1-…`, on mount). Controlled so the masked value is what
 * the form submits. Drop-in replacement for the plain phone <Field> in the customer forms.
 */
export function PhoneInput({
  name,
  label,
  defaultValue,
  required = false,
}: {
  name: string;
  label: string;
  defaultValue?: string | null;
  required?: boolean;
}) {
  const [value, setValue] = useState(() => formatPhone(defaultValue));
  return (
    <div className="space-y-1">
      <Label htmlFor={name}>
        {label}
        {required && <span className="text-destructive"> *</span>}
      </Label>
      <Input
        id={name}
        name={name}
        type="tel"
        inputMode="tel"
        autoComplete="tel"
        placeholder="000-000-0000"
        required={required}
        value={value}
        onChange={(e) => setValue(formatPhone(e.target.value))}
      />
    </div>
  );
}
