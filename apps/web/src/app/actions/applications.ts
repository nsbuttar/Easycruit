"use server";

import { applicationStatusSchema } from "@omniprofile/shared";
import { refresh } from "next/cache";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import { deleteApplication, updateApplicationStatus } from "@/lib/data/applications";
import { logError } from "@/lib/logger";

export interface ActionResult {
  ok: boolean;
  error?: string;
}

const idSchema = z.uuid();

async function mutate(
  event: string,
  run: (session: NonNullable<Awaited<ReturnType<typeof getSession>>>) => Promise<void>,
): Promise<ActionResult> {
  const session = await getSession();
  if (!session) return { ok: false, error: "Your session has expired. Please sign in again." };
  try {
    await run(session);
    refresh();
    return { ok: true };
  } catch (error) {
    logError(event, error);
    return { ok: false, error: "That change could not be saved. Please try again." };
  }
}

export async function setApplicationStatus(id: string, status: string): Promise<ActionResult> {
  const parsedId = idSchema.safeParse(id);
  const parsedStatus = applicationStatusSchema.safeParse(status);
  if (!parsedId.success || !parsedStatus.success) return { ok: false, error: "Invalid request." };
  return mutate("application.update_failed", ({ supabase, user }) =>
    updateApplicationStatus(supabase, user.id, parsedId.data, parsedStatus.data),
  );
}

export async function removeApplication(id: string): Promise<ActionResult> {
  const parsedId = idSchema.safeParse(id);
  if (!parsedId.success) return { ok: false, error: "Invalid request." };
  return mutate("application.delete_failed", ({ supabase, user }) =>
    deleteApplication(supabase, user.id, parsedId.data),
  );
}
