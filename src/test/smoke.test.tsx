import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

describe("testing setup", () => {
  it("renders with the jsdom environment", () => {
    render(<h1>raulmoracode</h1>);
    expect(screen.getByRole("heading", { name: "raulmoracode" })).toBeDefined();
  });
});
