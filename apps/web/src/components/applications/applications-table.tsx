"use client";

import { APPLICATION_STATUSES, type Application } from "@omniprofile/shared";
import { ExternalLinkIcon, Trash2Icon } from "lucide-react";
import { useTransition } from "react";
import { toast } from "sonner";
import { removeApplication, setApplicationStatus, type ActionResult } from "@/app/actions/applications";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const dateFormat = new Intl.DateTimeFormat("en", { dateStyle: "medium", timeZone: "UTC" });

function hostOf(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
}

function ApplicationRow({ application }: { application: Application }) {
  const [pending, startTransition] = useTransition();

  const run = (action: () => Promise<ActionResult>) =>
    startTransition(async () => {
      const result = await action();
      if (!result.ok) toast.error(result.error ?? "Something went wrong.");
    });

  const title = application.jobTitle || "Untitled role";

  return (
    <tr className="border-t" aria-busy={pending}>
      <td className="px-4 py-3">
        <a
          href={application.jobUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 font-medium hover:underline"
        >
          {title}
          <ExternalLinkIcon className="size-3 text-muted-foreground" />
        </a>
        <div className="text-sm text-muted-foreground">{application.companyName || hostOf(application.jobUrl)}</div>
      </td>
      <td className="px-4 py-3 text-sm whitespace-nowrap text-muted-foreground">
        {dateFormat.format(new Date(application.appliedAt))}
      </td>
      <td className="px-4 py-3">
        <Select
          value={application.status}
          disabled={pending}
          onValueChange={(status) => run(() => setApplicationStatus(application.id, status))}
        >
          <SelectTrigger className="w-36" aria-label={`Status for ${title}`}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {APPLICATION_STATUSES.map((status) => (
              <SelectItem key={status} value={status}>
                {status}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </td>
      <td className="px-4 py-3 text-right">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          disabled={pending}
          aria-label={`Delete ${title}`}
          onClick={() => run(() => removeApplication(application.id))}
        >
          <Trash2Icon />
        </Button>
      </td>
    </tr>
  );
}

export function ApplicationsTable({ applications }: { applications: Application[] }) {
  return (
    <div className="overflow-x-auto rounded-xl border">
      <table className="w-full text-left">
        <thead className="bg-muted/50 text-sm text-muted-foreground">
          <tr>
            <th className="px-4 py-2 font-medium">Role</th>
            <th className="px-4 py-2 font-medium">Filled</th>
            <th className="px-4 py-2 font-medium">Status</th>
            <th className="px-4 py-2">
              <span className="sr-only">Actions</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {applications.map((application) => (
            <ApplicationRow key={application.id} application={application} />
          ))}
        </tbody>
      </table>
    </div>
  );
}
