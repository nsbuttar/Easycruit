import "server-only";
import OpenAI from "openai";
import { serverEnv } from "@/lib/env";

/** The model call failed or returned something unusable. Carries no payload data. */
export class AiError extends Error {
  override name = "AiError";
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message);
  }
}

let client: OpenAI | undefined;
const openai = () => (client ??= new OpenAI({ apiKey: serverEnv.openaiApiKey, maxRetries: 2 }));

interface JsonCompletionParams {
  model: string;
  system: string;
  user: string;
  maxTokens: number;
}

/**
 * Single entry point for every OpenAI call. Always requests JSON mode
 * (`response_format: { type: "json_object" }`) and returns the parsed object;
 * callers validate its shape with zod.
 */
export async function completeJson({ model, system, user, maxTokens }: JsonCompletionParams): Promise<unknown> {
  let content: string | null | undefined;
  let finishReason: string | undefined;
  try {
    const completion = await openai().chat.completions.create({
      model,
      temperature: 0,
      max_completion_tokens: maxTokens,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    });
    content = completion.choices[0]?.message.content;
    finishReason = completion.choices[0]?.finish_reason;
  } catch (error) {
    // Deliberately drop the provider message: it can echo request content.
    const status = (error as { status?: unknown }).status;
    throw new AiError("Model request failed", typeof status === "number" ? status : undefined);
  }

  if (!content || finishReason === "length") throw new AiError("Model returned an incomplete response");
  try {
    return JSON.parse(content);
  } catch {
    throw new AiError("Model returned invalid JSON");
  }
}
