import type { Metadata } from "next";
import { Suspense } from "react";
import { Brand } from "@/components/brand";
import { safeNextPath } from "@/lib/auth";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Sign in" };

export default function LoginPage({ searchParams }: PageProps<"/login">) {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-6 px-4 py-12">
      <Brand />
      <Suspense fallback={<LoginForm next="/vault" initialMode="signin" />}>
        <ResolvedLoginForm searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

async function ResolvedLoginForm({ searchParams }: Pick<PageProps<"/login">, "searchParams">) {
  const params = await searchParams;
  return (
    <LoginForm
      next={safeNextPath(params.next)}
      initialMode={params.mode === "signup" ? "signup" : "signin"}
      initialError={params.error === "confirmation" ? "That confirmation link is invalid or has expired." : undefined}
    />
  );
}
