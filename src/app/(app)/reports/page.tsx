import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { BarChart3, CalendarPlus, CalendarX, Store } from "lucide-react";

// Reports landing. Each report becomes its own route as it is built out; for now
// these cards describe what is coming and keep the navigation structure in place.
const reports = [
  {
    title: "Customer–Vendor sign-ups",
    description: "Member stores by vendor and zone, with CSV export.",
    icon: Store,
    status: "Coming soon",
  },
  {
    title: "Date joined",
    description: "Members that joined within a date range.",
    icon: CalendarPlus,
    status: "Coming soon",
  },
  {
    title: "Date inactive",
    description: "Members marked inactive within a date range.",
    icon: CalendarX,
    status: "Coming soon",
  },
];

export default function ReportsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-semibold">
          <BarChart3 className="h-6 w-6" /> Reports
        </h1>
        <p className="text-sm text-muted-foreground">
          Run and export operational reports. More reports will be added here.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {reports.map((r) => {
          const Icon = r.icon;
          return (
            <Card key={r.title} className="h-full">
              <CardHeader>
                <div className="flex items-start justify-between gap-2">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Icon className="h-5 w-5 text-muted-foreground" />
                    {r.title}
                  </CardTitle>
                  <Badge variant="secondary">{r.status}</Badge>
                </div>
                <CardDescription>{r.description}</CardDescription>
              </CardHeader>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
