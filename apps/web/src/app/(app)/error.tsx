"use client";

import { Button } from "@/components/ui/button";

export default function AppError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="rounded-xl border border-dashed px-6 py-12 text-center">
      <p className="font-medium">We could not load this page</p>
      <p className="mt-1 text-sm text-muted-foreground">Your data is safe. Please try again in a moment.</p>
      <Button type="button" variant="outline" className="mt-4" onClick={reset}>
        Try again
      </Button>
    </div>
  );
}
