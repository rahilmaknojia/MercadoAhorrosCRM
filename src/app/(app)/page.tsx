import Link from "next/link";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AccessSummary } from "@/components/access-summary";
import { Users } from "lucide-react";

export default function DashboardPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Dashboard</h1>
        <p className="text-muted-foreground">Welcome to the Mercado Ahorros CRM.</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Link href="/customers" className="block">
          <Card className="h-full transition-colors hover:bg-muted/50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" /> Customers
              </CardTitle>
              <CardDescription>Browse and manage member stores</CardDescription>
            </CardHeader>
          </Card>
        </Link>
        <AccessSummary />
      </div>
    </div>
  );
}
