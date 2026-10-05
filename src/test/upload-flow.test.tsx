import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import App from "@/App";
import { useFontStore } from "@/store/font-store";
import { buildTrueTypeFont } from "./fixtures/truetype-builder";

function selectFile(file: File) {
  const input = document.querySelector<HTMLInputElement>('input[type="file"]');
  if (!input) throw new Error("file input not found");
  fireEvent.change(input, { target: { files: [file] } });
}

function fixtureFile(name = "Fixture.ttf") {
  return new File([buildTrueTypeFont()], name);
}

describe("font upload flow", () => {
  beforeEach(() => {
    useFontStore.getState().clearFont();
  });

  afterEach(() => {
    cleanup();
  });

  it("starts on an empty state with no font data", () => {
    render(<App />);

    expect(
      screen.getByRole("heading", { name: "Font Analyzer" }),
    ).toBeDefined();
    expect(screen.getByText(/Drag & drop your font here/)).toBeDefined();
    expect(screen.getByText("TTF · OTF · WOFF · WOFF2")).toBeDefined();

    // No sample font, no metrics, no glyphs before a file is chosen.
    expect(screen.queryByText("Overview")).toBeNull();
    expect(screen.queryByText("FONT OVERVIEW")).toBeNull();
  });

  it("analyses a selected font and shows real values", async () => {
    render(<App />);
    selectFile(fixtureFile());

    await waitFor(() => {
      expect(screen.getByText("FONT OVERVIEW")).toBeDefined();
    });

    expect(screen.getAllByText("Fixture TrueType").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Regular").length).toBeGreaterThan(0);
    expect(screen.getAllByText("TrueType").length).toBeGreaterThan(0);

    // Glyph count comes from maxp, not from a hardcoded number.
    const main = screen.getByRole("main");
    const glyphLabel = within(main).getByText("Glyphs");
    const glyphValue = glyphLabel.parentElement?.nextElementSibling;
    expect(glyphValue?.textContent).toBe("5");

    // The sidebar only lists sections the app can actually show.
    expect(screen.getByRole("button", { name: "Glyphs" })).toBeDefined();
    expect(
      screen.getByRole("button", { name: "Unicode Coverage" }),
    ).toBeDefined();
  });

  it("replaces the previous font when another is loaded", async () => {
    render(<App />);
    selectFile(fixtureFile("First.ttf"));

    await waitFor(() => {
      expect(screen.getByText("FONT OVERVIEW")).toBeDefined();
    });

    useFontStore.getState().clearFont();
    selectFile(fixtureFile("Second.ttf"));

    await waitFor(() => {
      expect(screen.getByText("FONT OVERVIEW")).toBeDefined();
    });

    // A single dashboard, not two stacked on top of each other.
    expect(screen.getAllByText("FONT OVERVIEW")).toHaveLength(1);
    expect(screen.getAllByRole("navigation")).toHaveLength(1);
  });

  it("shows a readable message for a file that is not a font", async () => {
    render(<App />);
    selectFile(new File([new TextEncoder().encode("nope")], "notes.txt"));

    await waitFor(() => {
      expect(screen.getByRole("alert")).toBeDefined();
    });
    const alert = screen.getByRole("alert");
    expect(alert.textContent).toMatch(/Unsupported|corrupted|couldn't/i);
    expect(
      within(alert).getByRole("button", { name: /Try another font/i }),
    ).toBeDefined();
    // Internal parser messages must never reach the user.
    expect(document.body.textContent).not.toMatch(/undefined|Cannot read/);
  });
});

describe("font information", () => {
  beforeEach(() => {
    useFontStore.getState().clearFont();
  });

  afterEach(() => {
    cleanup();
  });

  async function openInformation() {
    render(<App />);
    selectFile(fixtureFile());
    await waitFor(() => {
      expect(screen.getByText("FONT OVERVIEW")).toBeDefined();
    });
    fireEvent.click(screen.getByRole("button", { name: "Font Information" }));
    await waitFor(() => {
      expect(screen.getByText("FONT INFORMATION")).toBeDefined();
    });
  }

  it("shows the naming records decoded from the name table", async () => {
    await openInformation();

    const main = screen.getByRole("main");
    const rowText = (label: string) =>
      within(main).getByText(label).closest("tr")?.textContent ?? "";

    expect(rowText("Family Name")).toContain("Fixture TrueType");
    expect(rowText("Subfamily Name")).toContain("Regular");
    expect(rowText("PostScript Name")).toContain("Fixture TrueType-Regular");
    expect(rowText("Version")).toContain("Version 1.000");
  });

  it("marks fields the font does not carry as not available", async () => {
    await openInformation();

    const main = screen.getByRole("main");
    const rowText = (label: string) =>
      within(main).getByText(label).closest("tr")?.textContent ?? "";

    expect(rowText("Designer")).toContain("Not available");
    expect(rowText("License")).toContain("Not available");
    expect(rowText("Trademark")).toContain("Not available");
  });
});

describe("opentype tables", () => {
  beforeEach(() => {
    useFontStore.getState().clearFont();
  });

  afterEach(() => {
    cleanup();
  });

  it("lists only the tables the font actually contains", async () => {
    render(<App />);
    selectFile(fixtureFile());
    await waitFor(() => {
      expect(screen.getByText("FONT OVERVIEW")).toBeDefined();
    });

    fireEvent.click(screen.getByRole("button", { name: "OpenType Tables" }));
    await waitFor(() => {
      expect(screen.getByText("OPENTYPE TABLES")).toBeDefined();
    });

    const main = screen.getByRole("main");
    expect(within(main).getByText("glyf").closest("tr")?.textContent).toContain(
      "Glyph outlines",
    );
    expect(within(main).getByText("9 tables")).toBeDefined();

    // This fixture has no layout or colour tables, so none may be listed.
    expect(within(main).queryByText("GSUB")).toBeNull();
    expect(within(main).queryByText("OS/2")).toBeNull();
  });
});
