import { describe, expect, it } from "vitest";
import { safeHref } from "../src/core";

describe("safeHref", () => {
  it.each([
    "javascript:alert(1)",
    " javascript:alert(1)",
    "JaVaScRiPt:alert(1)",
    // The URL parser drops tabs and newlines anywhere and control characters at the start, so the
    // browser reads all of these as javascript: URLs.
    "java\nscript:alert(1)",
    "java\tscript:alert(1)",
    "java\rscript:alert(1)",
    "\x01javascript:alert(1)",
    "\x00javascript:alert(1)",
    "data:text/html,<script>alert(1)</script>",
    "vbscript:msgbox(1)",
    "file:///etc/passwd",
    "http://[invalid",
  ])("rejects %j", (url) => {
    expect(safeHref(url)).toBeUndefined();
  });

  it.each(["https://example.com/pancakes", "http://example.com", "/recipes/pancakes", "pancakes.html", "//example.com/x", "?q=1", "#top"])(
    "keeps %j",
    (url) => {
      expect(safeHref(url)).toBe(url);
    },
  );

  it("treats a missing or empty url as no link", () => {
    expect(safeHref(undefined)).toBeUndefined();
    expect(safeHref("")).toBeUndefined();
  });
});
