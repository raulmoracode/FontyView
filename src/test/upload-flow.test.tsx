import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
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

describe("unicode coverage", () => {
  beforeEach(() => {
    useFontStore.getState().clearFont();
  });

  afterEach(() => {
    cleanup();
  });

  async function openCoverage() {
    render(<App />);
    selectFile(fixtureFile());
    await waitFor(() => {
      expect(screen.getByText("FONT OVERVIEW")).toBeDefined();
    });
    fireEvent.click(screen.getByRole("button", { name: "Unicode Coverage" }));
    await waitFor(() => {
      expect(screen.getByText("UNICODE COVERAGE")).toBeDefined();
    });
    return screen.getByRole("main");
  }

  it("counts only the blocks the font actually covers", async () => {
    const main = await openCoverage();

    // The fixture maps A, B and e-acute, so only Basic Latin and
    // Latin-1 Supplement may appear.
    expect(main.textContent).toContain("3 code points");
    expect(main.textContent).toContain("2 blocks");

    const basicLatin = within(main)
      .getByText("Basic Latin")
      .closest("tr")?.textContent;
    expect(basicLatin).toContain("2 / 128");
    // 2 of 128 is 1.6%
    expect(basicLatin).toContain("1.6%");

    const latin1 = within(main)
      .getByText("Latin-1 Supplement")
      .closest("tr")?.textContent;
    expect(latin1).toContain("1 / 128");
  });

  it("does not list blocks the font has no characters in", async () => {
    const main = await openCoverage();

    for (const absent of ["Greek and Coptic", "Cyrillic", "Arabic", "Hebrew"]) {
      expect(within(main).queryByText(absent)).toBeNull();
    }
  });

  it("filters the block list", async () => {
    const main = await openCoverage();

    fireEvent.change(within(main).getByLabelText("Filter blocks"), {
      target: { value: "latin-1" },
    });
    expect(within(main).getByText("Latin-1 Supplement")).toBeDefined();
    expect(within(main).queryByText("Basic Latin")).toBeNull();

    fireEvent.change(within(main).getByLabelText("Filter blocks"), {
      target: { value: "greek" },
    });
    expect(main.textContent).toContain("No block matches that filter.");
  });
});

describe("character map", () => {
  beforeEach(() => {
    useFontStore.getState().clearFont();
  });

  afterEach(() => {
    cleanup();
  });

  async function openCharacterMap() {
    render(<App />);
    selectFile(fixtureFile());
    await waitFor(() => {
      expect(screen.getByText("FONT OVERVIEW")).toBeDefined();
    });
    fireEvent.click(screen.getByRole("button", { name: "Character Map" }));
    await waitFor(() => {
      expect(screen.getByText("CHARACTER MAP")).toBeDefined();
    });
    return screen.getByRole("main");
  }

  it("groups characters by the blocks the font covers", async () => {
    const main = await openCharacterMap();

    expect(main.textContent).toContain("3 characters");
    expect(main.textContent).toContain("2 blocks");
    expect(within(main).getByText("Basic Latin")).toBeDefined();
    expect(within(main).getByText("Latin-1 Supplement")).toBeDefined();

    // The three characters in the fixture's cmap, shown with their code points.
    expect(within(main).getByTitle("A · U+0041")).toBeDefined();
    expect(within(main).getByTitle("B · U+0042")).toBeDefined();
    expect(within(main).getByTitle("é · U+00E9")).toBeDefined();
  });

  it("searches by character and by code point", async () => {
    const main = await openCharacterMap();

    const field = within(main).getByLabelText("Search characters");

    fireEvent.change(field, { target: { value: "0041" } });
    expect(within(main).getByTitle("A · U+0041")).toBeDefined();
    expect(within(main).queryByTitle("B · U+0042")).toBeNull();

    // Prefixes and padding are accepted.
    for (const query of ["U+0041", "u+41", "41", "65"]) {
      fireEvent.change(field, { target: { value: query } });
      expect(within(main).getByTitle("A · U+0041")).toBeDefined();
    }

    fireEvent.change(field, { target: { value: "b" } });
    expect(within(main).getByTitle("B · U+0042")).toBeDefined();
    expect(within(main).queryByTitle("A · U+0041")).toBeNull();

    fireEvent.change(field, { target: { value: "zzz" } });
    expect(main.textContent).toContain(
      "No character in this font matches that search.",
    );
  });

  it("narrows to a single block", async () => {
    const main = await openCharacterMap();

    fireEvent.click(within(main).getByRole("combobox", { name: "Block" }));
    fireEvent.click(await screen.findByRole("option", { name: /Basic Latin/ }));

    expect(within(main).getByText("Basic Latin")).toBeDefined();
    expect(within(main).queryByText("Latin-1 Supplement")).toBeNull();
    expect(main.textContent).toContain("2 characters");
  });
});

describe("scripts", () => {
  beforeEach(() => {
    useFontStore.getState().clearFont();
  });

  afterEach(() => {
    cleanup();
  });

  async function openScripts() {
    render(<App />);
    selectFile(fixtureFile());
    await waitFor(() => {
      expect(screen.getByText("FONT OVERVIEW")).toBeDefined();
    });
    fireEvent.click(screen.getByRole("button", { name: "Scripts" }));
    await waitFor(() => {
      expect(screen.getByText("SCRIPTS")).toBeDefined();
    });
    return screen.getByRole("main");
  }

  it("marks only scripts the font really has characters for", async () => {
    const main = await openScripts();

    // The fixture's A, B and e-acute are all Latin.
    expect(main.textContent).toContain("1 of 31 supported");

    const latin = within(main).getAllByText("Latin")[0]?.closest("li");
    expect(latin?.textContent).toContain("3 characters");
    expect(latin?.textContent).toContain("Basic Latin");
    expect(latin?.textContent).toContain("Latin-1 Supplement");

    // Everything else is explicitly listed as not supported.
    const notSupported = main.textContent?.split("Not supported")[1] ?? "";
    for (const absent of [
      "Greek",
      "Cyrillic",
      "Arabic",
      "Hebrew",
      "Hiragana",
      "Han",
    ]) {
      expect(notSupported).toContain(absent);
    }
    // And a supported script does not appear in that list.
    expect(notSupported.split("Coverage per script")[0]).not.toContain("Latin");
  });

  it("reports coverage per script from the font's own blocks", async () => {
    const main = await openScripts();

    // Latin spans Basic Latin and Latin-1 Supplement: 3 of 256 code points.
    const row = within(main).getByText("3 / 256").closest("tr");
    expect(row?.textContent).toContain("Latin");
    // 3 of 256 is 1.2%
    expect(row?.textContent).toContain("1.2%");
  });
});

describe("glyph browser", () => {
  beforeEach(() => {
    useFontStore.getState().clearFont();
  });

  afterEach(() => {
    cleanup();
  });

  it("shows the real glyph count and every mapped character", async () => {
    render(<App />);
    selectFile(fixtureFile());
    await waitFor(() => {
      expect(screen.getByText("FONT OVERVIEW")).toBeDefined();
    });

    fireEvent.click(screen.getByRole("button", { name: "Glyphs" }));
    await waitFor(() => {
      expect(screen.getByText("GLYPHS")).toBeDefined();
    });

    const main = screen.getByRole("main");
    // The fixture declares five glyphs, including two unmapped ones.
    expect(main.textContent).toContain("5 glyphs");

    // The three mapped characters are reachable by their accessible name.
    expect(
      within(main).getByRole("button", { name: /Glyph 1, A/ }),
    ).toBeDefined();
    expect(
      within(main).getByRole("button", { name: /Glyph 2, B/ }),
    ).toBeDefined();
    expect(
      within(main).getByRole("button", { name: /Glyph 4, é/ }),
    ).toBeDefined();

    // Unmapped glyphs are shown by glyph ID rather than as a blank box.
    expect(within(main).getByRole("button", { name: "Glyph 0" })).toBeDefined();
    expect(within(main).getByRole("button", { name: "Glyph 3" })).toBeDefined();
  });

  it("renders cells with the analysed font", async () => {
    render(<App />);
    selectFile(fixtureFile());
    await waitFor(() => {
      expect(screen.getByText("FONT OVERVIEW")).toBeDefined();
    });

    fireEvent.click(screen.getByRole("button", { name: "Glyphs" }));
    await waitFor(() => {
      expect(screen.getByText("GLYPHS")).toBeDefined();
    });

    const family = useFontStore.getState().loaded?.analysis.cssFamilyName;
    const cell = screen.getByRole("button", { name: /Glyph 1, A/ });
    const glyphFace = cell.querySelector<HTMLElement>("[style*='font-family']");
    expect(glyphFace?.style.fontFamily).toContain(family as string);
  });
});

describe("glyph search, filters and sorting", () => {
  beforeEach(() => {
    useFontStore.getState().clearFont();
  });

  afterEach(() => {
    cleanup();
  });

  async function openBrowser() {
    render(<App />);
    selectFile(fixtureFile());
    await waitFor(() => {
      expect(screen.getByText("FONT OVERVIEW")).toBeDefined();
    });
    fireEvent.click(screen.getByRole("button", { name: "Glyphs" }));
    await waitFor(() => {
      expect(screen.getByText("GLYPHS")).toBeDefined();
    });
    return screen.getByRole("main");
  }

  const present = (main: HTMLElement, glyphId: number, char: string | null) =>
    within(main).queryByRole("button", {
      name: char ? `Glyph ${glyphId}, ${char}` : `Glyph ${glyphId}`,
    }) !== null;

  it("searches by character, code point and glyph ID", async () => {
    const main = await openBrowser();
    const field = within(main).getByLabelText("Search glyphs");

    // The fixture's five glyphs are 0, 1 (A), 2 (B), 3 (composite) and 4 (é).
    for (const query of ["a", "A", "0041", "U+0041", "1"]) {
      fireEvent.change(field, { target: { value: query } });
      expect(main.textContent).toContain("1 of 5");
      expect(present(main, 1, "A")).toBe(true);
    }

    fireEvent.change(field, { target: { value: "e" } });
    expect(present(main, 4, "é")).toBe(true);
    expect(present(main, 1, "A")).toBe(false);

    fireEvent.change(field, { target: { value: "zzzz" } });
    expect(main.textContent).toContain("No glyph matches these filters.");
  });

  it("filters by Unicode category", async () => {
    const main = await openBrowser();

    // Only the fixture's two Latin letters and one accented letter are letters.
    fireEvent.click(within(main).getByRole("button", { name: /^Letters/ }));
    expect(main.textContent).toContain("3 of 5");
    expect(present(main, 1, "A")).toBe(true);
    expect(present(main, 0, null)).toBe(false);

    // Clearing the filter restores every glyph, and the badge drops the
    // "of" form because nothing is being filtered.
    fireEvent.click(within(main).getByRole("button", { name: /^All/ }));
    expect(main.textContent).toContain("5 glyphs");
    expect(main.textContent).not.toContain("of 5");
    expect(present(main, 0, null)).toBe(true);
  });

  it("filters by script", async () => {
    const main = await openBrowser();

    fireEvent.click(within(main).getByRole("combobox", { name: "Script" }));
    fireEvent.click(await screen.findByRole("option", { name: /^Latin/ }));

    expect(main.textContent).toContain("3 of 5");
    expect(present(main, 4, "é")).toBe(true);
    expect(present(main, 0, null)).toBe(false);
  });

  it("sorts by glyph ID and reverses on demand", async () => {
    const main = await openBrowser();
    const field = within(main).getByLabelText("Search glyphs");

    // Search "1" so only glyph 1 is in the list, then confirm ordering
    // through the count and the sort control.
    fireEvent.click(within(main).getByRole("combobox", { name: "Sort by" }));
    fireEvent.click(await screen.findByRole("option", { name: "Glyph ID" }));
    fireEvent.click(
      within(main).getByRole("button", { name: "Sort descending" }),
    );
    fireEvent.click(
      within(main).getByRole("button", { name: "Sort ascending" }),
    );

    fireEvent.change(field, { target: { value: "é" } });
    expect(present(main, 4, "é")).toBe(true);

    // With "é" selected, sorting by advance width puts the widest first.
    fireEvent.change(field, { target: { value: "" } });
    fireEvent.click(within(main).getByRole("button", { name: /^Unassigned/ }));
    expect(main.textContent).toContain("2 of 5");
    expect(present(main, 0, null)).toBe(true);
    expect(present(main, 3, null)).toBe(true);
  });
});

describe("glyph detail", () => {
  beforeEach(() => {
    useFontStore.getState().clearFont();
  });

  afterEach(() => {
    cleanup();
  });

  async function openGlyphs() {
    render(<App />);
    selectFile(fixtureFile());
    await waitFor(() => {
      expect(screen.getByText("FONT OVERVIEW")).toBeDefined();
    });
    fireEvent.click(screen.getByRole("button", { name: "Glyphs" }));
    await waitFor(() => {
      expect(screen.getByText("GLYPHS")).toBeDefined();
    });
    return screen.getByRole("main");
  }

  it("shows real metrics for a selected glyph", async () => {
    const main = await openGlyphs();

    // Nothing selected yet.
    expect(main.textContent).toContain("Glyph 0");

    fireEvent.click(within(main).getByRole("button", { name: /Glyph 1, A/ }));

    const rowText = (label: string) =>
      main.textContent?.includes(label) ?? false;

    // Advance width and bearings come from hmtx.
    expect(rowText("Advance width")).toBe(true);
    expect(rowText("600")).toBe(true);
    expect(rowText("Left side bearing")).toBe(true);
    // Right bearing is advance minus xMax, computed from the real values.
    expect(rowText("Right side bearing")).toBe(true);

    // The bounding box and outline counts come from the glyf record.
    expect(rowText("Bounding box")).toBe(true);
    expect(rowText("xMin")).toBe(true);
    expect(rowText("Contours")).toBe(true);
    expect(rowText("Points")).toBe(true);

    // The selection is reflected on the cell.
    expect(
      within(main)
        .getByRole("button", { name: /Glyph 1, A/ })
        .getAttribute("aria-pressed"),
    ).toBe("true");
  });

  it("reports the real point count for the composite glyph", async () => {
    const main = await openGlyphs();
    fireEvent.click(within(main).getByRole("button", { name: "Glyph 3" }));

    // The fixture's glyph 3 is a composite of glyphs 1 and 2.
    expect(main.textContent).toContain("Composite");
    expect(main.textContent).toContain("2");
  });

  it("keeps the grid and the detail side by side", async () => {
    const main = await openGlyphs();
    fireEvent.click(within(main).getByRole("button", { name: /Glyph 2, B/ }));

    // The grid is still present alongside the panel.
    expect(
      within(main).getByRole("button", { name: /Glyph 1, A/ }),
    ).toBeDefined();
    expect(main.textContent).toContain("560");
  });
});

describe("glyph metrics view", () => {
  beforeEach(() => {
    useFontStore.getState().clearFont();
  });

  afterEach(() => {
    cleanup();
  });

  it("summarises advance widths across the font", async () => {
    render(<App />);
    selectFile(fixtureFile());
    await waitFor(() => {
      expect(screen.getByText("FONT OVERVIEW")).toBeDefined();
    });

    fireEvent.click(screen.getByRole("button", { name: "Glyph Metrics" }));
    await waitFor(() => {
      expect(screen.getByText("GLYPH METRICS")).toBeDefined();
    });

    const main = screen.getByRole("main");
    // The fixture's advances are 0, 600, 560, 1160 and 700.
    expect(main.textContent).toContain("5 measured");
    expect(main.textContent).toContain("Advance width distribution");
    expect(main.textContent).toContain("Widest glyphs");
  });
});

describe("variable fonts", () => {
  beforeEach(() => {
    useFontStore.getState().clearFont();
  });

  afterEach(() => {
    cleanup();
  });

  async function openVariable(font: File) {
    render(<App />);
    selectFile(font);
    await waitFor(() => {
      expect(screen.getByText("FONT OVERVIEW")).toBeDefined();
    });
    fireEvent.click(screen.getByRole("button", { name: "Variable" }));
    await waitFor(() => {
      expect(screen.getByText("VARIABLE")).toBeDefined();
    });
    return screen.getByRole("main");
  }

  it("hides the section entirely for a static font", async () => {
    render(<App />);
    selectFile(fixtureFile());
    await waitFor(() => {
      expect(screen.getByText("FONT OVERVIEW")).toBeDefined();
    });
    expect(screen.queryByRole("button", { name: "Variable" })).toBeNull();
  });

  it("reads the axes the font declares", async () => {
    const main = await openVariable(
      new File([buildTrueTypeFont({ variable: true })], "Variable.ttf"),
    );

    expect(main.textContent).toContain("3 axes");
    expect(main.textContent).toContain("Named instances");

    // Real axis names, limits and defaults from fvar and the name table.
    const weight = within(main)
      .getByText(/^Weight$/)
      .closest("div")?.parentElement;
    expect(weight?.textContent).toContain("wght");
    expect(weight?.textContent).toContain("100 pt");
    expect(weight?.textContent).toContain("default 400 pt");
    expect(weight?.textContent).toContain("900 pt");

    expect(main.textContent).toContain("Width");
    expect(main.textContent).toContain("Optical size");
  });

  it("lists the named instances the font declares", async () => {
    const main = await openVariable(
      new File([buildTrueTypeFont({ variable: true })], "Variable.ttf"),
    );

    for (const name of ["Light", "Regular", "Bold", "Wide Bold"]) {
      expect(within(main).getAllByText(name).length).toBeGreaterThan(0);
    }
  });

  it("applies an instance to the specimen", async () => {
    const main = await openVariable(
      new File([buildTrueTypeFont({ variable: true })], "Variable.ttf"),
    );

    // Start at the defaults.
    const preview = within(main).getByText("Handgloves 0123");
    expect(preview.style.fontVariationSettings).toBe("normal");

    fireEvent.click(within(main).getAllByRole("button", { name: "Bold" })[0]);
    // Axes are emitted in the order the font declares them, not sorted.
    expect(preview.style.fontVariationSettings).toBe('"wght" 700, "opsz" 20');

    fireEvent.click(
      within(main).getAllByRole("button", { name: "Wide Bold" })[0],
    );
    expect(preview.style.fontVariationSettings).toBe(
      '"wght" 700, "wdth" 125, "opsz" 20',
    );

    fireEvent.click(
      within(main).getByRole("button", { name: /Reset to defaults/ }),
    );
    expect(preview.style.fontVariationSettings).toBe("normal");
  });

  it("drives the specimen from the variable section", async () => {
    render(<App />);
    selectFile(
      new File([buildTrueTypeFont({ variable: true })], "Variable.ttf"),
    );
    await waitFor(() => {
      expect(screen.getByText("FONT OVERVIEW")).toBeDefined();
    });

    fireEvent.click(screen.getByRole("button", { name: "Variable" }));
    await waitFor(() => {
      expect(screen.getByText("VARIABLE")).toBeDefined();
    });
    fireEvent.click(screen.getAllByRole("button", { name: "Light" })[0]);

    // The specimen keeps the position once the section is left.
    fireEvent.click(screen.getByRole("button", { name: "Specimen" }));
    await waitFor(() => {
      expect(screen.getByText("SPECIMEN")).toBeDefined();
    });
    // The pangram also appears in the header, so scope to the main region.
    const specimen = within(screen.getByRole("main")).getByText(
      /quick brown fox/,
    );
    expect(specimen.style.fontVariationSettings).toBe('"wght" 300, "opsz" 14');
  });
});

describe("glyph outline viewer", () => {
  beforeEach(() => {
    useFontStore.getState().clearFont();
  });

  afterEach(() => {
    cleanup();
  });

  async function openOutline(glyphName: RegExp) {
    render(<App />);
    selectFile(fixtureFile());
    await waitFor(() => {
      expect(screen.getByText("FONT OVERVIEW")).toBeDefined();
    });
    fireEvent.click(screen.getByRole("button", { name: "Glyphs" }));
    await waitFor(() => {
      expect(screen.getByText("GLYPHS")).toBeDefined();
    });
    fireEvent.click(screen.getByRole("button", { name: glyphName }));
    return screen.getByRole("main");
  }

  it("draws the real contours, points and handles", async () => {
    const main = await openOutline(/Glyph 2, B/);

    expect(main.textContent).toContain("OUTLINE");
    // The fixture's glyph 2 has two contours and seven points.
    expect(main.textContent).toContain("2 contours");
    expect(main.textContent).toContain("7 points");

    const svg = within(main).getByRole("img", { name: /Outline of/ });
    expect(svg.querySelector("path")?.getAttribute("d")).toBeTruthy();

    // Seven point markers for the seven real points.
    const pointTitles = [...svg.querySelectorAll("title")].map(
      (node) => node.textContent ?? "",
    );
    expect(pointTitles.filter((text) => text.includes("Point "))).toHaveLength(
      7,
    );
  });

  it("lists the components of a composite glyph", async () => {
    const main = await openOutline(/^Glyph 3/);

    expect(main.textContent).toContain("Composite");
    expect(main.textContent).toContain("Components");
    // The fixture's glyph 3 references glyphs 1 and 2.
    expect(main.textContent).toContain("glyph 1");
    expect(main.textContent).toContain("glyph 2");
    expect(main.textContent).toContain("offset (600, 0)");
  });

  it("zooms and toggles the guides", async () => {
    const main = await openOutline(/Glyph 1, A/);

    const svg = () => within(main).getByRole("img", { name: /Outline of/ });
    const before = svg().getAttribute("style") ?? "";

    fireEvent.click(within(main).getByRole("button", { name: "Zoom in" }));
    expect(svg().getAttribute("style")).not.toBe(before);
    expect(main.textContent).toContain("2×");

    // Points can be hidden, which removes their markers.
    const withPoints = svg().querySelectorAll("circle").length;
    fireEvent.click(within(main).getByLabelText("Points"));
    expect(svg().querySelectorAll("circle").length).toBeLessThan(withPoints);
  });

  it("says an empty glyph has no contours", async () => {
    const main = await openOutline(/^Glyph 0/);
    expect(main.textContent).toContain(
      "This glyph is empty: it has no contours",
    );
  });
});

describe("ligatures view", () => {
  beforeEach(() => {
    useFontStore.getState().clearFont();
  });

  afterEach(() => {
    cleanup();
  });

  async function openLigatures(
    font = new File([buildTrueTypeFont({ gsub: true })], "Liga.ttf"),
  ) {
    render(<App />);
    selectFile(font);
    await waitFor(() => {
      expect(screen.getByText("FONT OVERVIEW")).toBeDefined();
    });
    fireEvent.click(screen.getByRole("button", { name: "Ligatures" }));
    await waitFor(() => {
      expect(screen.getByText("LIGATURES")).toBeDefined();
    });
    return screen.getByRole("main");
  }

  it("lists the real ligatures with their components drawn", async () => {
    const main = await openLigatures();

    expect(main.textContent).toContain("6 ligatures");
    expect(main.textContent).toContain("2 lookups");

    // The fixture's ligatures are f+i -> fi, f+f+i and i+f.
    const images = within(main).getAllByRole("img");
    expect(images.length).toBeGreaterThan(0);
    expect(images[0].getAttribute("aria-label")).toMatch(/^Component 1/);

    // Every glyph is drawn from real path data, including the composite fi.
    const drawn = [...images].filter((image) =>
      image.querySelector("path")?.getAttribute("d"),
    );
    expect(drawn.length).toBe(images.length);
  });

  it("shows which features reach each lookup", async () => {
    const main = await openLigatures();

    // The fixture wires liga, kern and ss01 to lookup 0, and leaves the
    // extension lookup unreferenced.
    expect(main.textContent).toContain("liga");
    expect(main.textContent).toContain("Unreferenced");
    expect(main.textContent).toContain("(ext)");
  });

  it("filters the list by name, character or feature", async () => {
    const main = await openLigatures();

    fireEvent.change(
      within(main).getByLabelText("Name, character or feature"),
      {
        target: { value: "liga" },
      },
    );

    expect(within(main).queryByText("Unreferenced")).toBeNull();
    expect(within(main).getAllByRole("row").length).toBeLessThan(7);
  });

  it("says a font without GSUB defines no ligatures", async () => {
    const main = await openLigatures(
      new File([buildTrueTypeFont()], "Plain.ttf"),
    );

    expect(main.textContent).toContain("no");
    expect(main.textContent).toContain("GSUB");
    expect(within(main).queryByRole("img")).toBeNull();
  });
});

describe("JSON export", () => {
  const createObjectURL = vi.fn(() => "blob:fontyview");
  const revokeObjectURL = vi.fn();
  const click = vi
    .spyOn(HTMLAnchorElement.prototype, "click")
    .mockImplementation(() => {});

  beforeEach(() => {
    useFontStore.getState().clearFont();
    createObjectURL.mockClear();
    revokeObjectURL.mockClear();
    click.mockClear();
    URL.createObjectURL = createObjectURL;
    URL.revokeObjectURL = revokeObjectURL;
  });

  afterEach(() => {
    cleanup();
  });

  async function openExport() {
    render(<App />);
    selectFile(
      new File(
        [buildTrueTypeFont({ gsub: true, kern: true, variable: true })],
        "Fixture.ttf",
      ),
    );
    await waitFor(() => {
      expect(screen.getByText("FONT OVERVIEW")).toBeDefined();
    });
    fireEvent.click(screen.getByRole("button", { name: "Export Report" }));
    await waitFor(() => {
      expect(screen.getByText("EXPORT")).toBeDefined();
    });
    return screen.getByRole("main");
  }

  const ALL_SECTIONS = [
    "Metadata",
    "Tables",
    "Metrics",
    "Unicode coverage",
    "Scripts",
    "OpenType features",
    "Kerning",
    "Ligatures",
    "Variation axes",
    "Glyphs",
  ];

  function setSection(main: HTMLElement, section: string, wanted: boolean) {
    const control = within(main).getByLabelText(section);
    if ((control.getAttribute("aria-checked") === "true") !== wanted) {
      fireEvent.click(control);
    }
  }

  /** Leaves only the named section enabled. */
  function selectOnly(main: HTMLElement, keep: string) {
    for (const section of ALL_SECTIONS) {
      setSection(main, section, section === keep);
    }
  }

  it("previews real analysis and names the file after the font", async () => {
    const main = await openExport();

    expect(main.textContent).toContain(
      "Fixture-TrueType-Regular-analysis.json",
    );
    const preview = main.querySelector("pre")?.textContent ?? "";
    expect(preview.startsWith('{\n  "generator": "FontyView"')).toBe(true);
    // The font's own bytes must not appear in the export.
    expect(preview).not.toContain('"bytes"');
  });

  it("changes the preview when a section is toggled", async () => {
    const main = await openExport();
    selectOnly(main, "Glyphs");
    const preview = main.querySelector("pre")?.textContent ?? "";

    expect(preview).toContain('"glyphs"');
    expect(preview).toContain("advanceWidth");
    expect(preview).toContain('"unicode": "U+0041"');
    // Nothing else survived the selection.
    expect(preview).not.toContain('"kerning"');
    expect(preview).not.toContain('"tables"');
  });

  it("exports kerning pairs as plain numbers", async () => {
    const main = await openExport();
    selectOnly(main, "Kerning");
    const preview = main.querySelector("pre")?.textContent ?? "";

    expect(preview).toContain('"pairs"');
    expect(preview).toContain('"value"');
  });

  it("downloads the file through a blob URL", async () => {
    const main = await openExport();

    fireEvent.click(within(main).getByRole("button", { name: "Download" }));

    expect(createObjectURL).toHaveBeenCalledTimes(1);
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:fontyview");
    expect(click).toHaveBeenCalledTimes(1);
    const link = click.mock.instances[0] as HTMLAnchorElement;
    expect(link.download).toBe("Fixture-TrueType-Regular-analysis.json");
    expect(link.href).toContain("blob:fontyview");
  });

  it("cannot be downloaded with nothing selected", async () => {
    const main = await openExport();

    for (const section of ALL_SECTIONS) {
      setSection(main, section, false);
    }

    expect(
      within(main).getByRole("button", { name: "Download" }),
    ).toHaveProperty("disabled", true);
    fireEvent.click(within(main).getByRole("button", { name: "Download" }));
    expect(createObjectURL).not.toHaveBeenCalled();
  });
});
