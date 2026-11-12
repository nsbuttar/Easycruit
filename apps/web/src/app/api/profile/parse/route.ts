import { parseCv } from "@/lib/ai/parse-cv";
import { apiError, handleApiError } from "@/lib/api";
import { getSession } from "@/lib/auth";
import { logEvent } from "@/lib/logger";
import { extractPdfText, PdfError } from "@/lib/pdf";

export const maxDuration = 60;

/**
 * POST multipart/form-data { file: PDF } -> { profile }
 *
 * Parses a CV into a draft profile. The draft is returned to the client for
 * review and is NOT saved here; the PDF and its text are never stored or logged.
 */
export async function POST(request: Request): Promise<Response> {
  try {
    const session = await getSession();
    if (!session) return apiError("unauthenticated", "Please sign in again.");

    const form = await request.formData().catch(() => null);
    const file = form?.get("file");
    if (!(file instanceof File)) return apiError("invalid_request", "Attach a PDF file.");

    const startedAt = Date.now();
    const text = await extractPdfText(file);
    const profile = await parseCv(text);

    logEvent("cv.parsed", {
      bytes: file.size,
      chars: text.length,
      workHistory: profile.workHistory.length,
      education: profile.education.length,
      skills: profile.skills.length,
      ms: Date.now() - startedAt,
    });
    return Response.json({ profile });
  } catch (error) {
    if (error instanceof PdfError) return apiError("invalid_request", error.message, 422);
    return handleApiError("cv.parse_failed", error);
  }
}
