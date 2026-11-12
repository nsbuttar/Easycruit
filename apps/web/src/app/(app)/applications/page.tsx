import type { Metadata } from "next";
import { Suspense } from "react";
import { ApplicationsTable } from "@/components/applications/applications-table";
import { requireSession } from "@/lib/auth";
import { listApplications } from "@/lib/data/applications";

export const metadata: Metadata = { title: "Applications" };

export default function ApplicationsPage() {
  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Applications</h1>
        <p className="text-muted-foreground">
          Every form the extension fills is logged here. Update the status as each application progresses.
        </p>
      </div>
      <Suspense fallback={<p className="text-sm text-muted-foreground">Loading applications…</p>}>
        <Applications />
      </Suspense>
    </div>
  );
}

async function Applications() {
  const { supabase, user } = await requireSession("/applications");
  const applications = await listApplications(supabase, user.id);

  if (applications.length === 0) {
    return (
      <div className="rounded-xl border border-dashed px-6 py-12 text-center">
        <p className="font-medium">No applications yet</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Open a job on Workday, Greenhouse, Lever or Taleo and click &ldquo;Auto-Fill with OmniProfile&rdquo;.
        </p>
      </div>
    );
  }
  return <ApplicationsTable applications={applications} />;
}
