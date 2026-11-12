import { EXTENSION_API } from "@omniprofile/shared";
import type { Metadata } from "next";
import { Suspense } from "react";
import { Brand } from "@/components/brand";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requireSession } from "@/lib/auth";
import { isAllowedRedirectUri, isValidCodeChallenge } from "@/lib/extension-auth";

export const metadata: Metadata = { title: "Connect extension" };

type Props = PageProps<"/extension/authorize">;

const first = (value: string | string[] | undefined): string => (Array.isArray(value) ? value[0] : value) ?? "";

/** OAuth consent screen opened by the extension via chrome.identity.launchWebAuthFlow. */
export default function AuthorizeExtensionPage({ searchParams }: Props) {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-6 px-4 py-12">
      <Brand />
      <Suspense fallback={<p className="text-sm text-muted-foreground">Loading…</p>}>
        <Consent searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

async function Consent({ searchParams }: Pick<Props, "searchParams">) {
  const params = await searchParams;
  const request = {
    redirect_uri: first(params.redirect_uri),
    state: first(params.state),
    code_challenge: first(params.code_challenge),
  };

  const method = first(params.code_challenge_method);
  const query = new URLSearchParams({ ...request, code_challenge_method: method }).toString();
  const { user } = await requireSession(`${EXTENSION_API.authorize}?${query}`);

  const valid =
    isAllowedRedirectUri(request.redirect_uri) &&
    isValidCodeChallenge(request.code_challenge) &&
    request.state.length > 0 &&
    method === "S256";

  if (!valid) {
    return (
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>Invalid connection request</CardTitle>
          <CardDescription>
            This link did not come from a recognised OmniProfile extension. Open the extension and choose
            Connect to try again.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card className="w-full max-w-sm">
      <CardHeader>
        <CardTitle>Connect the browser extension?</CardTitle>
        <CardDescription>
          Signed in as <span className="font-medium text-foreground">{user.email}</span>
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
          <li>Fill job application forms using your vault profile</li>
          <li>Log the applications it fills to your tracker</li>
        </ul>
        <form method="post" action="/api/extension/authorize">
          {Object.entries(request).map(([name, value]) => (
            <input key={name} type="hidden" name={name} value={value} />
          ))}
          <Button type="submit" className="w-full">
            Connect extension
          </Button>
        </form>
        <p className="text-xs text-muted-foreground">You can disconnect at any time from the extension popup.</p>
      </CardContent>
    </Card>
  );
}
