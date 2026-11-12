import { FileUpIcon, MousePointerClickIcon, ShieldCheckIcon } from "lucide-react";
import Link from "next/link";
import { Brand } from "@/components/brand";
import { Button } from "@/components/ui/button";

const STEPS = [
  {
    icon: FileUpIcon,
    title: "Upload your CV once",
    body: "Drop in a PDF. AI turns it into a structured profile you can review and correct.",
  },
  {
    icon: MousePointerClickIcon,
    title: "Auto-fill any application",
    body: "On Workday, Greenhouse, Lever or Taleo, one click maps your profile onto the form.",
  },
  {
    icon: ShieldCheckIcon,
    title: "You stay in control",
    body: "Anything we are not sure about is left blank and highlighted. Nothing is ever submitted for you.",
  },
];

export default function LandingPage() {
  return (
    <div className="flex flex-1 flex-col">
      <header className="mx-auto flex w-full max-w-5xl items-center justify-between px-4 py-4">
        <Brand />
        <Button asChild variant="ghost">
          <Link href="/login">Sign in</Link>
        </Button>
      </header>

      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col justify-center gap-16 px-4 py-16">
        <section className="max-w-2xl space-y-6">
          <h1 className="text-4xl font-semibold tracking-tight text-balance sm:text-5xl">
            Stop retyping your CV into every job application.
          </h1>
          <p className="text-lg text-muted-foreground text-pretty">
            OmniProfile is your professional identity vault. Keep one master profile and let the browser
            extension fill in applicant tracking systems for you.
          </p>
          <div className="flex flex-wrap gap-3">
            <Button asChild size="lg">
              <Link href="/login?mode=signup">Create your vault</Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link href="/vault">Open my vault</Link>
            </Button>
          </div>
        </section>

        <section className="grid gap-8 sm:grid-cols-3">
          {STEPS.map(({ icon: Icon, title, body }) => (
            <div key={title} className="space-y-2">
              <Icon className="size-5 text-muted-foreground" />
              <h2 className="font-medium">{title}</h2>
              <p className="text-sm text-muted-foreground">{body}</p>
            </div>
          ))}
        </section>
      </main>
    </div>
  );
}
