import { emptyProfile } from "@omniprofile/shared";
import type { Metadata } from "next";
import { Suspense } from "react";
import { VaultEditor } from "@/components/vault/vault-editor";
import { requireSession } from "@/lib/auth";
import { getProfile } from "@/lib/data/profiles";

export const metadata: Metadata = { title: "Vault" };
// CV parsing runs through /api/profile/parse; saving is a Server Action on this page.
export const maxDuration = 60;

export default function VaultPage() {
  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Your vault</h1>
        <p className="text-muted-foreground">
          This master profile is what the extension uses to fill job applications. Review it carefully.
        </p>
      </div>
      <Suspense fallback={<p className="text-sm text-muted-foreground">Loading your profile…</p>}>
        <Vault />
      </Suspense>
    </div>
  );
}

async function Vault() {
  const { supabase, user } = await requireSession("/vault");
  const profile = await getProfile(supabase, user.id);
  const initial = profile ?? { ...emptyProfile(), contactInfo: { ...emptyProfile().contactInfo, email: user.email } };
  return <VaultEditor initialProfile={initial} isNew={profile === null} />;
}
