"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { useDropzone } from "react-dropzone";
import type {
  PdfWorkerOutboundMessage,
  PdfWorkerInboundMessage,
  PdfParseResult,
} from "@/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";

export default function UploadPage() {
  const workerRef = useRef<Worker | null>(null);
  const [progress, setProgress] = useState<number>(0);
  const [status, setStatus] = useState<string>("Idle");
  const [result, setResult] = useState<PdfParseResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const ensureWorker = useCallback(() => {
    if (workerRef.current) return workerRef.current;
    // Next.js 15 App Router supports web workers with new Worker(new URL(..., import.meta.url)) under Turbopack
    const worker = new Worker(
      new URL("@/workers/pdf-worker.ts", import.meta.url),
      { type: "module" }
    );
    worker.onmessage = (ev: MessageEvent<PdfWorkerOutboundMessage>) => {
      const data = ev.data;
      if (data.kind === "progress") {
        setProgress(data.progressPercent);
        if (data.message) setStatus(data.message);
      } else if (data.kind === "complete") {
        setStatus("Complete");
        setProgress(100);
        setResult(data.result);
      } else if (data.kind === "error") {
        setError(data.message);
        setStatus("Error");
      }
    };
    workerRef.current = worker;
    return worker;
  }, []);

  const onDrop = useCallback(
    async (acceptedFiles: File[]) => {
      setError(null);
      setResult(null);
      setProgress(0);
      setStatus("Reading file");
      const worker = ensureWorker();

      const file = acceptedFiles[0];
      if (!file) return;
      const buffer = await file.arrayBuffer();
      const msg: PdfWorkerInboundMessage = {
        kind: "parse",
        fileName: file.name,
        fileBuffer: buffer,
      };
      worker.postMessage(msg);
    },
    [ensureWorker]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { "application/pdf": [".pdf"] },
    multiple: false,
  });

  const hasOutput = Boolean(result || error);

  return (
    <div className="mx-auto max-w-2xl p-4 space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Upload Bank Statement (PDF)</CardTitle>
        </CardHeader>
        <CardContent>
          <div
            {...getRootProps({
              className:
                "flex h-40 cursor-pointer items-center justify-center rounded-md border border-dashed p-4 text-center " +
                (isDragActive ? "bg-muted" : ""),
            })}
          >
            <input {...getInputProps()} />
            {isDragActive ? (
              <p>Drop the PDF here ...</p>
            ) : (
              <p>Drag and drop a PDF here, or click to select</p>
            )}
          </div>

          <div className="mt-4 space-y-2">
            <Progress value={progress} />
            <div className="text-sm text-muted-foreground">{status}</div>
          </div>

          {hasOutput && (
            <div className="mt-4">
              {error ? (
                <div className="text-sm text-red-600">{error}</div>
              ) : (
                <pre className=" overflow-auto rounded bg-muted p-2 text-xs">
                  {JSON.stringify(result, null, 2)}
                </pre>
              )}
            </div>
          )}

          <div className="mt-4 flex gap-2">
            <Button
              variant="secondary"
              onClick={() => {
                setProgress(0);
                setStatus("Idle");
                setResult(null);
                setError(null);
              }}
            >
              Reset
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
