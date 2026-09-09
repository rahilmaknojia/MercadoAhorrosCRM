import { isPrivileged } from "@/lib/server/authz";
import { MemberImport } from "@/components/member-import";

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
        <h1 className="text-2xl font-semibold tracking-tight">Import members</h1>
        <p className="text-sm text-muted-foreground">
          Upload the legacy member export. Members are matched on their MA member id: a new id
          creates a member, an existing one is updated only where the file actually differs.
          A blank cell never clears a value that is already in the CRM. Nothing is written until
          you review the preview and confirm.
        </p>
      </div>
      <MemberImport />
    </div>
  );
}
