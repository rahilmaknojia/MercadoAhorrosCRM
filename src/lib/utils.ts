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
