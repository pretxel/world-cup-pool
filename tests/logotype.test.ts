import { describe, expect, it } from "vitest";
import { renderToString } from "react-dom/server";
import React from "react";
import { Logotype } from "@/components/logotype";

describe("Logotype", () => {
  for (const size of ["xs", "md", "xl"] as const) {
    it(`renders exactly one <svg> at size="${size}"`, () => {
      const html = renderToString(React.createElement(Logotype, { size }));
      const svgMatches = html.match(/<svg\b/g) ?? [];
      expect(svgMatches).toHaveLength(1);
      expect(html).toMatch(/viewBox="0 0 \d+ \d+"/);
    });
  }

  it("compact size (xs) drops the · Pool suffix", () => {
    const html = renderToString(React.createElement(Logotype, { size: "xs" }));
    expect(html).not.toContain("POOL");
  });

  it("non-compact sizes include the POOL suffix", () => {
    const html = renderToString(React.createElement(Logotype, { size: "md" }));
    expect(html).toContain("POOL");
  });
});
