import { describe, expect, it } from "vitest";
import { PAGE_SIZE, paginate, parsePageParam } from "@/lib/pagination";

describe("paginate", () => {
  it("splits a multi-page set and reports page 1 bounds", () => {
    const info = paginate(12, 1, 5);
    expect(info).toEqual({ page: 1, totalPages: 3, start: 0, end: 5 });
  });

  it("returns correct bounds for a middle page", () => {
    expect(paginate(12, 2, 5)).toMatchObject({ page: 2, start: 5, end: 10 });
  });

  it("returns the partial last page's bounds", () => {
    expect(paginate(12, 3, 5)).toMatchObject({ page: 3, start: 10, end: 12 });
  });

  it("clamps a page above the range down to the last page", () => {
    expect(paginate(12, 99, 5).page).toBe(3);
  });

  it("clamps a below-range page up to 1", () => {
    expect(paginate(12, 0, 5).page).toBe(1);
    expect(paginate(12, -4, 5).page).toBe(1);
  });

  it("clamps a non-finite page to 1", () => {
    expect(paginate(12, Number.NaN, 5).page).toBe(1);
  });

  it("treats an exact multiple as full pages", () => {
    expect(paginate(10, 1, 5).totalPages).toBe(2);
  });

  it("returns a single page when items fit on one page", () => {
    expect(paginate(3, 1, 5)).toEqual({
      page: 1,
      totalPages: 1,
      start: 0,
      end: 3,
    });
  });

  it("returns one (empty) page for zero items", () => {
    expect(paginate(0, 1, 5)).toEqual({
      page: 1,
      totalPages: 1,
      start: 0,
      end: 0,
    });
  });

  it("defaults the page size to PAGE_SIZE (5)", () => {
    expect(PAGE_SIZE).toBe(5);
    expect(paginate(12, 1).totalPages).toBe(3);
  });
});

describe("parsePageParam", () => {
  it("parses a numeric string", () => {
    expect(parsePageParam("2")).toBe(2);
  });

  it("takes the first value of an array param", () => {
    expect(parsePageParam(["3", "x"])).toBe(3);
  });

  it("falls back to 1 for missing, non-numeric, or non-positive values", () => {
    expect(parsePageParam(undefined)).toBe(1);
    expect(parsePageParam("abc")).toBe(1);
    expect(parsePageParam("0")).toBe(1);
    expect(parsePageParam("-4")).toBe(1);
  });
});
