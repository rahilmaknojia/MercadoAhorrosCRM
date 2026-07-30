import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Normalize a phone number to `000-000-0000`. Strips non-digits, drops a US country code
 * (a leading 1 on an 11-digit number, so `+1-713-555-1000` → `713-555-1000`), and groups the
 * rest. Partial input is formatted as far as it goes, so this also drives live input masking.
 * A value with no digits comes back empty — callers fall back to the raw value for display.
 */
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]

/** `"2025-01"` -> `"Jan '25"`. Leaves anything that isn't a yyyy-MM key untouched. */
export function formatMonthKey(key: string): string {
  const m = /^(\d{4})-(\d{2})$/.exec(key)
  if (!m) return key
  const month = MONTHS[Number(m[2]) - 1]
  return month ? `${month} '${m[1].slice(2)}` : key
}

export function formatPhone(value?: string | null): string {
  if (!value) return ""
  let digits = value.replace(/\D/g, "")
  if (digits.length === 11 && digits.startsWith("1")) digits = digits.slice(1)
  digits = digits.slice(0, 10)
  if (digits.length <= 3) return digits
  if (digits.length <= 6) return `${digits.slice(0, 3)}-${digits.slice(3)}`
  return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`
}

/** Federal tax id (EIN) as `##-#######` (9 digits). */
export function formatFederalTaxId(value?: string | null): string {
  if (!value) return ""
  const digits = value.replace(/\D/g, "").slice(0, 9)
  if (digits.length <= 2) return digits
  return `${digits.slice(0, 2)}-${digits.slice(2)}`
}

/** Sales tax id: digits grouped in fours (`1234-5678-9012-345`), up to 15 digits. */
export function formatSalesTaxId(value?: string | null): string {
  if (!value) return ""
  const digits = value.replace(/\D/g, "").slice(0, 15)
  return digits.replace(/(.{4})(?=.)/g, "$1-")
}

/** Valid email, or empty (the field is optional). */
export function isValidEmail(value?: string | null): boolean {
  const trimmed = (value ?? "").trim()
  return trimmed.length === 0 || /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(trimmed)
}
