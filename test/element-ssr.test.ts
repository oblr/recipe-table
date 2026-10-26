// @vitest-environment node
import { describe, expect, it } from "vitest";
import pkg from "../package.json";

describe("recipe-table/element without a DOM", () => {
  it("imports and defineRecipeTable() is a no-op", async () => {
    const { defineRecipeTable } = await import("../src/element");
    expect(() => defineRecipeTable()).not.toThrow();
  });

  it("does not make npm install React for element-only users", () => {
    expect(pkg.peerDependenciesMeta.react.optional).toBe(true);
  });
});
