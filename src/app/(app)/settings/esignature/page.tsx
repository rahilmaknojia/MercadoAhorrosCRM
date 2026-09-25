import { apiFetch } from "@/lib/server/api";
import type { EsignatureTemplate, SurveyFieldCatalog, VendorGroup } from "@/lib/types";
import { EsignatureTemplateManager } from "@/components/esignature-template-manager";

async function fetchArray<T>(path: string): Promise<T[]> {
  try {
    const res = await apiFetch(path);
    if (!res.ok) return [];
    const body = (await res.json()) as T[] | { items?: T[] };
    return Array.isArray(body) ? body : (body.items ?? []);
  } catch {
    return [];
  }
}

// The Site Survey merge-token catalog (single source of truth in the API). null on failure: the
// template manager still offers the source and says the list could not be loaded.
async function fetchSurveyCatalog(): Promise<SurveyFieldCatalog | null> {
  try {
    const res = await apiFetch("/api/esignature/survey-fields");
    if (!res.ok) return null;
    const body = (await res.json()) as Partial<SurveyFieldCatalog>;
    return { groups: body.groups ?? [], formats: body.formats ?? [] };
  } catch {
    return null;
  }
}

export default async function EsignatureSettingsPage() {
  // The vendor catalogue powers the "vendor account" mapping source; templates are the registry.
  const [templates, vendorGroups, surveyCatalog] = await Promise.all([
    fetchArray<EsignatureTemplate>("/api/esignature-templates?pageSize=200"),
    fetchArray<VendorGroup>("/api/vendors/grouped"),
    fetchSurveyCatalog(),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-semibold">eSignature templates</h1>
        <p className="text-sm text-muted-foreground">
          Onboard a NinjaFlow template and map its signer roles and merge fields to customer,
          vendor, site survey, and store-metadata data. Active templates can be sent from any customer page.
        </p>
      </div>
      <EsignatureTemplateManager
        templates={templates}
        vendorGroups={vendorGroups}
        surveyCatalog={surveyCatalog}
      />
    </div>
  );
}
