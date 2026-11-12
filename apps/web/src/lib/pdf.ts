import "server-only";
import { extractText, getDocumentProxy } from "unpdf";

export const MAX_PDF_BYTES = 5 * 1024 * 1024;
const PDF_MAGIC = [0x25, 0x50, 0x44, 0x46]; // "%PDF"
/** Below this, the PDF is almost certainly a scan with no text layer. */
const MIN_TEXT_CHARS = 200;

export class PdfError extends Error {
  override name = "PdfError";
}

/** Validates an uploaded file and returns its text. Nothing is written to disk. */
export async function extractPdfText(file: File): Promise<string> {
  if (file.size === 0) throw new PdfError("The file is empty.");
  if (file.size > MAX_PDF_BYTES) throw new PdfError("The PDF must be 5 MB or smaller.");

  const bytes = new Uint8Array(await file.arrayBuffer());
  if (!PDF_MAGIC.every((byte, index) => bytes[index] === byte)) {
    throw new PdfError("Only PDF files are supported.");
  }

  let text: string;
  try {
    const document = await getDocumentProxy(bytes);
    ({ text } = await extractText(document, { mergePages: true }));
  } catch {
    throw new PdfError("This PDF could not be read. It may be corrupted or password-protected.");
  }

  const cleaned = text.replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim();
  if (cleaned.length < MIN_TEXT_CHARS) {
    throw new PdfError("No text was found in this PDF. Scanned or image-only CVs are not supported yet.");
  }
  return cleaned;
}
