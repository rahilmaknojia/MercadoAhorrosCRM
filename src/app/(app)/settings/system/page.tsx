import { apiFetch } from "@/lib/server/api";
import { SystemSettingsManager } from "@/components/system-settings-manager";

async function fetchSettings(): Promise<Record<string, string>> {
  try {
    const res = await apiFetch("/api/settings");
    if (!res.ok) return {};
    const data = await res.json();
    return data && typeof data === "object" ? (data as Record<string, string>) : {};
  } catch {
    return {};
  }
}

export default async function SystemSettingsPage() {
  const settings = await fetchSettings();
  const autoApprove =
    (settings["AutoGenerateMemberIdOnApproval"] ?? "false").toLowerCase() === "true";

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">System settings</h1>
        <p className="text-sm text-muted-foreground">
          Owner-only configuration that changes how the app behaves for everyone.
        </p>
      </div>
      <SystemSettingsManager autoGenerateMemberIdOnApproval={autoApprove} />
    </div>
  );
}
