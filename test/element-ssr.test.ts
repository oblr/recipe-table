// @vitest-environment node
import { describe, expect, it } from "vitest";

describe("recipe-table/element without a DOM", () => {
  it("imports and defineRecipeTable() is a no-op", async () => {
    const { defineRecipeTable } = await import("../src/element");
    expect(() => defineRecipeTable()).not.toThrow();
  });
});
