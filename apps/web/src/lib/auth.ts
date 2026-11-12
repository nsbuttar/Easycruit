import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export interface SessionUser {
  id: string;
  email: string;
}

export interface Session {
  user: SessionUser;
  /** RLS-scoped client for this user. */
  supabase: SupabaseClient;
}

/** Verifies the session with Supabase Auth. Returns null when signed out. */
export async function getSession(): Promise<Session | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return null;
  return { user: { id: data.user.id, email: data.user.email ?? "" }, supabase };
}

/** For pages: redirects signed-out visitors to the login screen. */
export async function requireSession(next?: string): Promise<Session> {
  const session = await getSession();
  if (!session) redirect(next ? `/login?next=${encodeURIComponent(next)}` : "/login");
  return session;
}

/** Only same-origin relative paths are accepted as post-login destinations. */
export function safeNextPath(next: unknown, fallback = "/vault"): string {
  if (typeof next !== "string") return fallback;
  if (!next.startsWith("/") || next.startsWith("//") || next.includes("\\")) return fallback;
  return next;
}
