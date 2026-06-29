"use client";

import { usePermissions } from "@/components/permissions-provider";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export function AccessSummary() {
  const { roles, permissions } = usePermissions();
  return (
    <Card>
      <CardHeader>
        <CardTitle>Your access</CardTitle>
        <CardDescription>What you can do is enforced by the API.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap gap-1">
          {roles.length ? (
            roles.map((r) => (
              <Badge key={r} variant="secondary" className="capitalize">
                {r}
              </Badge>
            ))
          ) : (
            <span className="text-sm text-muted-foreground">No role assigned</span>
          )}
        </div>
        <p className="text-sm text-muted-foreground">{permissions.length} permission(s) granted</p>
      </CardContent>
    </Card>
  );
}
