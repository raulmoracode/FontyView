import { AlertCircle, RotateCcw } from "lucide-react";
import { useId, useState } from "react";
import { Button } from "@/components/ui/button";
import { useFontStore } from "@/store/font-store";
import { FontDropzone } from "./font-dropzone";

const ACCEPT = ".ttf,.otf,.woff,.woff2,font/ttf,font/otf,font/woff,font/woff2";

/**
 * The initial screen. No font is preloaded and no sample data is shown: the
 * only way in is the user's own file.
 */
export function UploadScreen() {
  const [isDragging, setIsDragging] = useState(false);
  const inputId = useId();
  const status = useFontStore((state) => state.status);
  const error = useFontStore((state) => state.error);
  const loadFont = useFontStore((state) => state.loadFont);
  const clearFont = useFontStore((state) => state.clearFont);

  const isBusy = status === "analyzing";

  function handleFiles(files: FileList | null) {
    const file = files?.[0];
    if (!file) return;
    void loadFont(file);
  }

  return (
    <main className="flex min-h-svh w-full items-center justify-center px-6 py-16">
      <div className="flex w-full max-w-2xl flex-col gap-10">
        <header className="flex flex-col gap-3">
          <h1 className="text-2xl font-semibold tracking-tight">
            Font Analyzer
          </h1>
          <p className="max-w-prose text-sm leading-relaxed text-muted-foreground">
            Analyze and inspect any typeface. Everything runs locally in your
            browser, and your font never leaves this device.
          </p>
        </header>

        {error ? (
          <div
            role="alert"
            className="flex flex-col items-start gap-4 rounded-lg border border-destructive/30 bg-destructive/5 p-6"
          >
            <div className="flex items-start gap-3">
              <AlertCircle
                aria-hidden="true"
                className="mt-0.5 size-4 shrink-0 text-destructive"
              />
              <div className="flex flex-col gap-1">
                <p className="text-sm font-medium">{error.title}</p>
                <p className="max-w-prose text-sm leading-relaxed text-muted-foreground">
                  {error.body}
                </p>
              </div>
            </div>
            <Button variant="outline" size="sm" onClick={clearFont}>
              <RotateCcw aria-hidden="true" />
              Try another font
            </Button>
          </div>
        ) : null}

        <FontDropzone
          inputId={inputId}
          isDragging={isDragging}
          isBusy={isBusy}
          onDragEnter={(event) => {
            event.preventDefault();
            if (!isBusy) setIsDragging(true);
          }}
          onDragLeave={(event) => {
            event.preventDefault();
            if (event.currentTarget === event.target) setIsDragging(false);
          }}
          onDrop={(event) => {
            event.preventDefault();
            setIsDragging(false);
            if (!isBusy) handleFiles(event.dataTransfer.files);
          }}
        />

        <input
          id={inputId}
          type="file"
          accept={ACCEPT}
          className="sr-only"
          onChange={(event) => {
            handleFiles(event.target.files);
            event.target.value = "";
          }}
        />

        <p className="text-xs leading-relaxed text-muted-foreground">
          Your font is analyzed entirely in the browser and is never uploaded or
          stored.
        </p>
      </div>
    </main>
  );
}
