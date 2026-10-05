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

describe("font metrics", () => {
  beforeEach(() => {
    useFontStore.getState().clearFont();
  });

  afterEach(() => {
    cleanup();
  });

  it("shows vertical metrics from head, hhea and post", async () => {
    render(<App />);
    selectFile(fixtureFile());
    await waitFor(() => {
      expect(screen.getByText("FONT OVERVIEW")).toBeDefined();
    });

    fireEvent.click(screen.getByRole("button", { name: "Font Metrics" }));
    await waitFor(() => {
      expect(screen.getByText("FONT METRICS")).toBeDefined();
    });

    // Labels also appear in the diagram, so match on the table row itself.
    const rowText = (label: string) =>
      screen
        .getAllByText(label)
        .map((node) => node.closest("tr")?.textContent ?? "")
        .find((text) => text.length > 0) ?? "";

    // hhea
    expect(rowText("Ascender")).toContain("800");
    expect(rowText("Descender")).toContain("-200");
    expect(rowText("Line gap")).toContain("90");
    // post
    expect(rowText("Underline position")).toContain("-100");
    expect(rowText("Underline thickness")).toContain("50");
  });

  it("reports metrics the font lacks as not available", async () => {
    render(<App />);
    selectFile(fixtureFile());
    await waitFor(() => {
      expect(screen.getByText("FONT OVERVIEW")).toBeDefined();
    });

    fireEvent.click(screen.getByRole("button", { name: "Font Metrics" }));
    await waitFor(() => {
      expect(screen.getByText("FONT METRICS")).toBeDefined();
    });

    const rowText = (label: string) =>
      screen
        .getAllByText(label)
        .map((node) => node.closest("tr")?.textContent ?? "")
        .find((text) => text.length > 0) ?? "";

    // This fixture has no OS/2 table, so these must not be invented.
    expect(rowText("Cap height")).toContain("Not available");
    expect(rowText("x-height")).toContain("Not available");
    expect(rowText("Windows ascent")).toContain("Not available");
  });
});

describe("metrics diagram", () => {
  beforeEach(() => {
    useFontStore.getState().clearFont();
  });

  afterEach(() => {
    cleanup();
  });

  it("draws only the guides the font provides", async () => {
    render(<App />);
    selectFile(fixtureFile());
    await waitFor(() => {
      expect(screen.getByText("FONT OVERVIEW")).toBeDefined();
    });

    fireEvent.click(screen.getByRole("button", { name: "Font Metrics" }));
    const diagram = await screen.findByRole("img", {
      name: "Vertical metrics diagram",
    });

    // hhea ascender 800 and descender -200 exist, so both guides are drawn.
    expect(within(diagram).getByText("Ascender")).toBeDefined();
    expect(within(diagram).getByText("Descender")).toBeDefined();
    expect(within(diagram).getByText("800")).toBeDefined();
    expect(within(diagram).getByText("-200")).toBeDefined();

    // OS/2 is absent, so cap height and x-height guides must not be drawn.
    expect(within(diagram).queryByText("Cap height")).toBeNull();
    expect(within(diagram).queryByText("x-height")).toBeNull();
    expect(within(diagram).queryByText("Win ascent")).toBeNull();

    // The em square is annotated with the real units per em.
    expect(diagram.textContent).toContain("em square 1,000 units");
  });
});

describe("specimen", () => {
  beforeEach(() => {
    useFontStore.getState().clearFont();
  });

  afterEach(() => {
    cleanup();
  });

  async function openSpecimen() {
    render(<App />);
    selectFile(fixtureFile());
    await waitFor(() => {
      expect(screen.getByText("FONT OVERVIEW")).toBeDefined();
    });
    fireEvent.click(screen.getByRole("button", { name: "Specimen" }));
    await waitFor(() => {
      expect(screen.getByText("SPECIMEN")).toBeDefined();
    });
  }

  it("renders the standard character sets at the full size scale", async () => {
    await openSpecimen();
    const main = screen.getByRole("main");

    // Each step of the scale renders a specimen at its own font size.
    const specimens = [
      ...main.querySelectorAll<HTMLElement>("[style*='font-size']"),
    ];
    const rendered = new Set(specimens.map((node) => node.style.fontSize));
    for (const size of [
      "12px",
      "16px",
      "20px",
      "24px",
      "32px",
      "40px",
      "48px",
      "64px",
      "80px",
      "96px",
      "120px",
      "160px",
    ]) {
      expect(rendered.has(size)).toBe(true);
    }

    // Uppercase is the default tab.
    expect(within(main).getByText("ABCDEFGHIJKLMNOPQRSTUVWXYZ")).toBeDefined();
  });

  it("renders text with the uploaded font, not a fallback", async () => {
    await openSpecimen();
    const main = screen.getByRole("main");

    const state = useFontStore.getState();
    expect(state.status).toBe("ready");
    const family = state.loaded?.analysis.cssFamilyName;
    expect(family).toBeTruthy();

    const pangram = within(main).getByText(/The quick brown fox/);
    expect(pangram.style.fontFamily).toContain(family as string);
  });

  it("re-renders custom text as the user types", async () => {
    await openSpecimen();
    const main = screen.getByRole("main");

    const field = within(main).getByLabelText("Write your own text");
    fireEvent.change(field, { target: { value: "Zebra stripes" } });

    expect(within(main).getByText("Zebra stripes")).toBeDefined();
    expect(within(main).queryByText(/quick brown fox/)).toBeNull();
  });

  it("applies a custom size to the scale", async () => {
    await openSpecimen();
    const main = screen.getByRole("main");

    fireEvent.change(within(main).getByLabelText("Custom size"), {
      target: { value: "222" },
    });

    expect(within(main).getByText("222px")).toBeDefined();
  });

  it("applies alignment from the controls", async () => {
    await openSpecimen();
    const main = screen.getByRole("main");

    const trigger = within(main).getByRole("combobox", { name: "Alignment" });
    fireEvent.click(trigger);
    fireEvent.click(await screen.findByRole("option", { name: "center" }));

    const pangram = within(main).getByText(/quick brown fox/);
    expect(pangram.style.textAlign).toBe("center");
  });
});

describe("opentype features", () => {
  beforeEach(() => {
    useFontStore.getState().clearFont();
  });

  afterEach(() => {
    cleanup();
  });

  async function openFeatures(font: File) {
    render(<App />);
    selectFile(font);
    await waitFor(() => {
      expect(screen.getByText("FONT OVERVIEW")).toBeDefined();
    });
    fireEvent.click(screen.getByRole("button", { name: "Features" }));
    await waitFor(() => {
      expect(screen.getByText("FEATURES")).toBeDefined();
    });
    return screen.getByRole("main");
  }

  it("says so plainly when a font has no layout tables", async () => {
    const main = await openFeatures(fixtureFile());
    expect(main.textContent).toContain(
      "This font has no GSUB or GPOS table, so it implements no OpenType layout features.",
    );
  });

  it("lists the features a GSUB table really declares", async () => {
    const main = await openFeatures(
      new File([buildTrueTypeFont({ gsub: true })], "Layout.ttf"),
    );

    // The three features written into the fixture's GSUB.
    expect(within(main).getByText("liga").closest("tr")?.textContent).toContain(
      "Standard ligatures",
    );
    expect(within(main).getByText("kern").closest("tr")?.textContent).toContain(
      "Kerning",
    );
    expect(within(main).getByText("ss01").closest("tr")?.textContent).toContain(
      "Stylistic set 1",
    );

    // Lookup types are resolved from the real lookup list.
    expect(main.textContent).toContain("Ligature substitution");
    expect(main.textContent).toContain("Single positioning");
    expect(main.textContent).toContain("Extension substitution");

    // And the script system is reported.
    expect(main.textContent).toContain("DFLT");
  });

  it("never lists a feature the font does not declare", async () => {
    const main = await openFeatures(
      new File([buildTrueTypeFont({ gsub: true })], "Layout.ttf"),
    );

    for (const absent of ["smcp", "onum", "tnum", "frac", "calt", "ss02"]) {
      expect(within(main).queryByText(absent)).toBeNull();
    }
  });
});

describe("specimen feature toggles", () => {
  beforeEach(() => {
    useFontStore.getState().clearFont();
  });

  afterEach(() => {
    cleanup();
  });

  async function openSpecimen(font: File) {
    render(<App />);
    selectFile(font);
    await waitFor(() => {
      expect(screen.getByText("FONT OVERVIEW")).toBeDefined();
    });
    fireEvent.click(screen.getByRole("button", { name: "Specimen" }));
    await waitFor(() => {
      expect(screen.getByText("SPECIMEN")).toBeDefined();
    });
    return screen.getByRole("main");
  }

  it("says there is nothing to toggle without layout tables", async () => {
    const main = await openSpecimen(fixtureFile());
    expect(main.textContent).toContain(
      "This font has no GSUB or GPOS table, so there are no features to switch on or off.",
    );
  });

  it("offers a switch per detected feature and applies it to the specimen", async () => {
    const main = await openSpecimen(
      new File([buildTrueTypeFont({ gsub: true })], "Layout.ttf"),
    );

    // Exactly the three features the fixture declares.
    const liga = within(main).getByRole("switch", { name: /liga/ });
    const kern = within(main).getByRole("switch", { name: /kern/ });
    const ss01 = within(main).getByRole("switch", { name: /ss01/ });
    expect(liga).toBeDefined();
    expect(kern).toBeDefined();
    expect(ss01).toBeDefined();
    expect(within(main).queryByRole("switch", { name: /smcp/ })).toBeNull();

    const specimen = within(main).getByText(/quick brown fox/);
    // Nothing enabled yet, so the specimen is left on the font's defaults.
    expect(specimen.style.fontFeatureSettings).toBe("normal");

    fireEvent.click(liga);
    expect(specimen.style.fontFeatureSettings).toBe('"liga"');

    // Output is sorted, so the value does not depend on click order.
    fireEvent.click(kern);
    expect(specimen.style.fontFeatureSettings).toBe('"kern", "liga"');

    fireEvent.click(liga);
    expect(specimen.style.fontFeatureSettings).toBe('"kern"');

    fireEvent.click(kern);
    expect(specimen.style.fontFeatureSettings).toBe("normal");
  });

  it("drives the type scale and character sets too", async () => {
    const main = await openSpecimen(
      new File([buildTrueTypeFont({ gsub: true })], "Layout.ttf"),
    );

    fireEvent.click(within(main).getByRole("switch", { name: /liga/ }));

    const scaled = [
      ...main.querySelectorAll<HTMLElement>("[style*='font-size']"),
    ];
    expect(scaled.length).toBeGreaterThan(0);
    for (const node of scaled) {
      expect(node.style.fontFeatureSettings).toBe('"liga"');
    }
  });
});

describe("kerning", () => {
  beforeEach(() => {
    useFontStore.getState().clearFont();
  });

  afterEach(() => {
    cleanup();
  });

  async function openKerning(font: File) {
    render(<App />);
    selectFile(font);
    await waitFor(() => {
      expect(screen.getByText("FONT OVERVIEW")).toBeDefined();
    });
    fireEvent.click(screen.getByRole("button", { name: "Kerning" }));
    await waitFor(() => {
      expect(screen.getByText("KERNING")).toBeDefined();
    });
    return screen.getByRole("main");
  }

  it("says plainly when a font has no kerning data", async () => {
    const main = await openKerning(fixtureFile());
    expect(main.textContent).toContain(
      "This font contains no kerning data. There is no legacy kern table and no GPOS pair positioning, so no pair is adjusted.",
    );
  });

  it("reads the pairs out of a legacy kern table", async () => {
    const main = await openKerning(
      new File([buildTrueTypeFont({ kern: true })], "Kerned.ttf"),
    );

    // Three pairs were written into the fixture.
    expect(main.textContent).toContain("kern · 3 pairs");
    expect(main.textContent).toContain("3 distinct pairs");

    // The real values, with the glyphs they came from.
    expect(within(main).getByText("-60").closest("tr")?.textContent).toContain(
      "1 → 2",
    );
    expect(within(main).getByText("-20").closest("tr")?.textContent).toContain(
      "1 → 4",
    );
    expect(within(main).getByText("-55").closest("tr")?.textContent).toContain(
      "2 → 1",
    );
  });

  it("looks up a custom pair and reports when none is defined", async () => {
    const main = await openKerning(
      new File([buildTrueTypeFont({ kern: true })], "Kerned.ttf"),
    );

    const field = within(main).getByLabelText("Enter pair");

    // A and B are glyphs 1 and 2, and the fixture kerns that pair to -60.
    fireEvent.change(field, { target: { value: "AB" } });
    expect(main.textContent).toContain("-60 units");
    expect(main.textContent).toContain("glyphs 1 → 2");

    // B followed by A is also defined.
    fireEvent.change(field, { target: { value: "BA" } });
    expect(main.textContent).toContain("-55 units");

    // A and e-acute is the third pair in the fixture.
    fireEvent.change(field, { target: { value: "Aé" } });
    expect(main.textContent).toContain("-20 units");
  });

  it("does not invent a value for a pair the font does not kern", async () => {
    const main = await openKerning(
      new File([buildTrueTypeFont({ kern: true })], "Kerned.ttf"),
    );

    const field = within(main).getByLabelText("Enter pair");

    // Both characters exist in the font, but the pair is not kerned.
    fireEvent.change(field, { target: { value: "éB" } });
    expect(main.textContent).toContain("No kerning pair defined");
    expect(main.textContent).toContain("No adjustment");

    // A pair the font has no characters for is reported as such.
    fireEvent.change(field, { target: { value: "éW" } });
    expect(main.textContent).toContain(
      "One of these characters is not in the font.",
    );
  });
});
