"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const LINKS = [
  { href: "/vault", label: "Vault" },
  { href: "/applications", label: "Applications" },
] as const;

export function NavLinks() {
  const pathname = usePathname();
  return (
    <nav className="flex items-center gap-4 text-sm">
      {LINKS.map(({ href, label }) => (
        <Link
          key={href}
          href={href}
          aria-current={pathname.startsWith(href) ? "page" : undefined}
          className={cn(
            "text-muted-foreground transition-colors hover:text-foreground",
            pathname.startsWith(href) && "font-medium text-foreground",
          )}
        >
          {label}
        </Link>
      ))}
    </nav>
  );
}
