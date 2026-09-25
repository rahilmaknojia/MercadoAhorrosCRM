import { isPrivileged } from "@/lib/server/authz";
import { MemberImport } from "@/components/member-import";
import { ComplianceImport } from "@/components/compliance-import";
import { Tabs, TabsIndicator, TabsList, TabsPanel, TabsTab } from "@/components/ui/tabs";

export default async function ImportPage() {
  // Hard gate with a denial panel, matching /settings/users. A bulk import writes hundreds of
  // members in one action, so the page itself is Owner/Admin only rather than rendering for
  // everyone and disabling the controls.
  if (!(await isPrivileged())) {
    return (
      <div className="rounded-md border border-destructive/40 bg-destructive/5 p-6 text-sm text-destructive">
        You don&apos;t have permission to import members. Only Owners and Admins can.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Import</h1>
        <p className="text-sm text-muted-foreground">
          Bring legacy data into the CRM. Nothing is written until you review the preview and confirm.
        </p>
      </div>

      <Tabs defaultValue="members">
        <TabsList>
          <TabsTab value="members">Members</TabsTab>
          <TabsTab value="compliance">Compliance review history</TabsTab>
          <TabsIndicator />
        </TabsList>

        <TabsPanel value="members" className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Upload the legacy member export. Members are matched on their MA member id: a new id
            creates a member, an existing one is updated only where the file actually differs.
            A blank cell never clears a value that is already in the CRM.
          </p>
          <MemberImport />
        </TabsPanel>

        <TabsPanel value="compliance" className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Upload the export of the legacy <code className="rounded bg-muted px-1">compliance_review</code>{" "}
            table (columns <code className="rounded bg-muted px-1">id, customer_id, version, data, created_on,
            modified_on, modified_by</code>). Run it after the member import: reviews are matched to
            members by their legacy id. Every version is imported as history, the latest becomes the
            current review, and blank reviews the legacy app auto-saved are skipped. Re-running is safe.
          </p>
          <ComplianceImport />
        </TabsPanel>
      </Tabs>
    </div>
  );
}
