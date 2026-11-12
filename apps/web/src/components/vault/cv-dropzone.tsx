"use client";

import { candidateProfileSchema, type ApiErrorBody, type CandidateProfile } from "@omniprofile/shared";
import { FileUpIcon, Loader2Icon } from "lucide-react";
import { useCallback, useState } from "react";
import { useDropzone, type FileRejection } from "react-dropzone";
import { cn } from "@/lib/utils";

const MAX_BYTES = 5 * 1024 * 1024;

async function parseCv(file: File): Promise<CandidateProfile> {
  const body = new FormData();
  body.set("file", file);
  const response = await fetch("/api/profile/parse", { method: "POST", body });
  const payload: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const message = (payload as ApiErrorBody | null)?.error?.message;
    throw new Error(message ?? "We could not read that CV. Please try again.");
  }
  return candidateProfileSchema.parse((payload as { profile?: unknown } | null)?.profile);
}

interface CvDropzoneProps {
  onParsed: (profile: CandidateProfile) => void;
}

export function CvDropzone({ onParsed }: CvDropzoneProps) {
  const [parsing, setParsing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onDrop = useCallback(
    async (accepted: File[], rejected: FileRejection[]) => {
      const [file] = accepted;
      if (!file) {
        setError(rejected.length > 0 ? "Upload a single PDF of 5 MB or less." : null);
        return;
      }
      setError(null);
      setParsing(true);
      try {
        onParsed(await parseCv(file));
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : "We could not read that CV.");
      } finally {
        setParsing(false);
      }
    },
    [onParsed],
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { "application/pdf": [".pdf"] },
    maxFiles: 1,
    maxSize: MAX_BYTES,
    disabled: parsing,
  });

  return (
    <div className="space-y-2">
      <div
        {...getRootProps()}
        className={cn(
          "flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border border-dashed px-6 py-10 text-center transition-colors",
          "hover:bg-muted/50 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
          isDragActive && "border-primary bg-muted",
          parsing && "cursor-progress opacity-80",
        )}
      >
        <input {...getInputProps()} aria-label="Upload CV as PDF" />
        {parsing ? (
          <>
            <Loader2Icon className="size-6 animate-spin text-muted-foreground" />
            <p className="font-medium">Reading your CV…</p>
            <p className="text-sm text-muted-foreground">This usually takes 10 to 20 seconds.</p>
          </>
        ) : (
          <>
            <FileUpIcon className="size-6 text-muted-foreground" />
            <p className="font-medium">{isDragActive ? "Drop your CV here" : "Drag and drop your CV, or click to browse"}</p>
            <p className="text-sm text-muted-foreground">PDF, up to 5 MB. The file itself is never stored.</p>
          </>
        )}
      </div>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
