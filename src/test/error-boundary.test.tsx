import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ErrorBoundary } from "@/components/error-boundary";

function Boom({ shouldThrow }: { shouldThrow: boolean }) {
  if (shouldThrow) throw new Error("parser returned something unexpected");
  return <p>rendered fine</p>;
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("ErrorBoundary", () => {
  it("renders its children when nothing throws", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    render(
      <ErrorBoundary label="Glyphs">
        <Boom shouldThrow={false} />
      </ErrorBoundary>,
    );

    expect(screen.getByText("rendered fine")).toBeDefined();
  });

  it("keeps a failure inside the boundary", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    render(
      <ErrorBoundary label="Glyphs">
        <Boom shouldThrow />
      </ErrorBoundary>,
    );

    expect(screen.getByText(/Glyphs could not be displayed/)).toBeDefined();
    // The cause stays visible rather than being swallowed.
    expect(
      screen.getByText(/parser returned something unexpected/),
    ).toBeDefined();
  });

  it("says the rest of the analysis is unaffected", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    render(
      <ErrorBoundary label="Kerning">
        <Boom shouldThrow />
      </ErrorBoundary>,
    );

    expect(
      screen.getByText(/rest of the analysis is unaffected/),
    ).toBeDefined();
  });

  it("logs the cause so it is recoverable", () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    render(
      <ErrorBoundary label="Ligatures">
        <Boom shouldThrow />
      </ErrorBoundary>,
    );

    expect(error).toHaveBeenCalled();
    // React prefixes its own format, so the label is checked across the call.
    const logged = error.mock.calls.map((call) => call.join(" ")).join(" ");
    expect(logged).toContain("Ligatures");
  });

  it("calls onReset when trying again", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const onReset = vi.fn();
    render(
      <ErrorBoundary label="Specimen" onReset={onReset}>
        <Boom shouldThrow />
      </ErrorBoundary>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(onReset).toHaveBeenCalledTimes(1);
  });

  it("renders children again once the error is cleared", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    function Host() {
      return (
        <ErrorBoundary label="Compare">
          <Boom shouldThrow={false} />
        </ErrorBoundary>
      );
    }
    const { rerender } = render(<Host />);
    rerender(
      <ErrorBoundary label="Compare">
        <Boom shouldThrow />
      </ErrorBoundary>,
    );
    expect(screen.getByText(/could not be displayed/)).toBeDefined();
  });
});
