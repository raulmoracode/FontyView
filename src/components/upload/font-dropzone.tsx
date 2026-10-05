import { cn } from "@/lib/utils";

/**
 * Drop target rendered as a label bound to the real file input, so clicking is
 * handled natively by the browser rather than reimplemented with ARIA.
 */
export function FontDropzone({
  inputId,
  isDragging,
  isBusy,
  onDragEnter,
  onDragLeave,
  onDrop,
  className,
}: {
  inputId: string;
  isDragging: boolean;
  isBusy: boolean;
  onDragEnter: (event: React.DragEvent) => void;
  onDragLeave: (event: React.DragEvent) => void;
  onDrop: (event: React.DragEvent) => void;
  className?: string;
}) {
  return (
    <label
      htmlFor={inputId}
      className={cn(
        "group flex w-full cursor-pointer flex-col items-center justify-center gap-6 rounded-lg border border-dashed px-6 py-14 text-center transition-colors",
        "focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2 focus-within:ring-offset-background",
        isDragging
          ? "border-foreground bg-muted"
          : "border-border bg-card hover:border-muted-foreground/40",
        isBusy && "pointer-events-none opacity-60",
        className,
      )}
      onDragEnter={onDragEnter}
      onDragOver={onDragEnter}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
    >
      <div
        aria-hidden="true"
        className="grid grid-cols-5 gap-1.5 text-2xl leading-none"
      >
        {["A", "B", "g", "3", "@"].map((char) => (
          <span
            key={char}
            className="flex size-10 items-center justify-center rounded border border-border text-muted-foreground transition-colors group-hover:text-foreground"
          >
            {char}
          </span>
        ))}
      </div>

      <div className="flex flex-col gap-1.5">
        <p className="text-base font-medium">
          {isDragging ? "Drop to analyze" : "Drag & drop your font here"}
        </p>
        <p className="text-sm text-muted-foreground">
          or click to select a file
        </p>
      </div>

      <p className="font-mono text-xs tracking-wider text-muted-foreground">
        TTF · OTF · WOFF · WOFF2
      </p>
    </label>
  );
}
