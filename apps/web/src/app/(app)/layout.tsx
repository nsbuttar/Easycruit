import { Suspense } from "react";
import { signOut } from "@/app/actions/auth";
import { Brand } from "@/components/brand";
import { NavLinks } from "@/components/nav-links";
import { Button } from "@/components/ui/button";
import { getSession } from "@/lib/auth";

export default function AppLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="flex flex-1 flex-col">
      <header className="border-b">
        <div className="mx-auto flex w-full max-w-5xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3">
          <Brand href="/vault" />
          <NavLinks />
          <div className="ml-auto flex items-center gap-3">
            <Suspense fallback={null}>
              <UserEmail />
            </Suspense>
            <form action={signOut}>
              <Button type="submit" variant="outline" size="sm">
                Sign out
              </Button>
            </form>
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8">{children}</main>
    </div>
  );
}

async function UserEmail() {
  const session = await getSession();
  if (!session) return null;
  return <span className="hidden text-sm text-muted-foreground sm:inline">{session.user.email}</span>;
}
