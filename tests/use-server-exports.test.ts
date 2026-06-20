import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

// Guard: a `"use server"` module may export ONLY async functions (server
// actions) and type-only declarations. A non-function export (e.g. a Zod
// schema or a const object) makes Next.js throw at runtime —
// `A "use server" file can only export async functions, found object` — which
// breaks every page that imports the module. typecheck does NOT catch this, so
// this test does. Regression guard for the profile-actions push-schema bug.

const ROOTS = ["app", "lib"];

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    if (e.name === "node_modules" || e.name.startsWith(".")) continue;
    const p = join(dir, e.name);
    if (e.isDirectory()) out.push(...walk(p));
    else if (e.name.endsWith(".ts") || e.name.endsWith(".tsx")) out.push(p);
  }
  return out;
}

// True only when the file carries the actual `"use server"` DIRECTIVE (a bare
// string-literal statement), not the phrase inside a comment.
function hasUseServerDirective(src: string): boolean {
  return /^\s*["']use server["'];?\s*$/m.test(src);
}

// A top-level export that is allowed in a "use server" module.
const ALLOWED =
  /^export (async function |default async function |type |interface |type\{|type \{)/;

function badExports(src: string): string[] {
  return src
    .split("\n")
    .map((line, i) => ({ line, n: i + 1 }))
    .filter(({ line }) => /^export\b/.test(line) && !ALLOWED.test(line))
    .map(({ line, n }) => `L${n}: ${line.trim()}`);
}

describe("'use server' modules export only async functions", () => {
  const files = ROOTS.flatMap((r) => walk(r)).filter((f) =>
    hasUseServerDirective(readFileSync(f, "utf8")),
  );

  it("finds the server-action modules", () => {
    // Sanity: the scan actually picks up known action files.
    expect(files.some((f) => f.endsWith("profile-actions.ts"))).toBe(true);
  });

  for (const f of files) {
    it(`${f} exports only async functions / types`, () => {
      expect(badExports(readFileSync(f, "utf8"))).toEqual([]);
    });
  }
});
