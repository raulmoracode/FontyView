import { useFontStore } from "@/store/font-store";

const STEPS = [
  "Reading font",
  "Detecting format",
  "Unpacking tables",
  "Reading font header",
  "Reading character map",
  "Analysing metrics",
  "Building analysis",
];

/**
 * Indeterminate loading state. No invented progress percentage is shown,
 * because the real cost of each step depends on the file.
 */
export function AnalyzingScreen() {
  const step = useFontStore((state) => state.progressStep);
  const fileName = useFontStore((state) => state.fileName);
  const activeIndex = Math.max(0, STEPS.indexOf(step ?? STEPS[0]));

  return (
    <main
      aria-busy="true"
      className="flex min-h-svh w-full items-center justify-center px-6 py-16"
    >
      <div className="flex w-full max-w-md flex-col gap-8">
        <header className="flex flex-col gap-3">
          <h1 className="text-2xl font-semibold tracking-tight">
            Analyzing font
          </h1>
          {fileName ? (
            <p className="truncate font-mono text-xs text-muted-foreground">
              {fileName}
            </p>
          ) : null}
        </header>

        <ol className="flex flex-col gap-1">
          {STEPS.map((entry, index) => {
            const isActive = index === activeIndex;
            const isDone = index < activeIndex;
            return (
              <li
                key={entry}
                aria-current={isActive ? "step" : undefined}
                className="flex items-center gap-3 py-1 text-sm"
              >
                <span
                  aria-hidden="true"
                  className={
                    isActive
                      ? "size-1.5 animate-pulse rounded-full bg-foreground"
                      : isDone
                        ? "size-1.5 rounded-full bg-foreground/40"
                        : "size-1.5 rounded-full bg-border"
                  }
                />
                <span
                  className={
                    isActive
                      ? "text-foreground"
                      : isDone
                        ? "text-muted-foreground"
                        : "text-muted-foreground/50"
                  }
                >
                  {entry}
                </span>
              </li>
            );
          })}
        </ol>

        <div
          role="progressbar"
          aria-label="Analyzing font"
          className="h-px w-full overflow-hidden bg-border"
        >
          <div className="h-full w-1/3 animate-pulse bg-foreground/60" />
        </div>
      </div>
    </main>
  );
}
