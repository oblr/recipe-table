import { cleanup, render, screen } from "@testing-library/react";
import Ajv2020 from "ajv/dist/2020";
import { afterEach, describe, expect, it } from "vitest";
import schema from "../recipe.schema.json";
import { layoutRecipe, MAX_ITEMS, prepareRecipe, RecipeTable, validateRecipe, type Recipe } from "../src";
import { defineRecipeTable } from "../src/element";

// Recipes may come from users or LLMs. No input, however large or malformed, may throw or hang:
// invalid data renders an error block (ADR 010).

afterEach(() => {
  cleanup();
  document.body.replaceChildren();
});

/** One ingredient, then `steps` steps each using the previous one: the deepest possible tree. */
const chain = (steps: number): Recipe => ({
  schemaVersion: 1,
  title: "Chain",
  ingredients: [{ id: "i0", name: "x" }],
  steps: Array.from({ length: steps }, (_, k) => ({ id: `s${k}`, action: "stir", inputs: [k === 0 ? "i0" : `s${k - 1}`] })),
});

/** `n` ingredients all going into one step: the widest possible tree. */
const wide = (n: number): Recipe => ({
  schemaVersion: 1,
  title: "Wide",
  ingredients: Array.from({ length: n }, (_, k) => ({ id: `i${k}`, name: "x" })),
  steps: [{ id: "s", action: "mix", inputs: Array.from({ length: n }, (_, k) => `i${k}`) }],
});

const elapsed = (f: () => unknown) => {
  const start = performance.now();
  f();
  return performance.now() - start;
};

describe("size limits", () => {
  it("accepts and lays out the largest allowed recipes quickly", () => {
    for (const recipe of [chain(MAX_ITEMS), wide(MAX_ITEMS)]) {
      let result: ReturnType<typeof prepareRecipe> | undefined;
      expect(elapsed(() => (result = prepareRecipe(recipe)))).toBeLessThan(500);
      expect(result!.errors).toEqual([]);
    }
  });

  it.each([
    ["steps", chain(MAX_ITEMS + 1), "/steps"],
    ["ingredients", wide(MAX_ITEMS + 1), "/ingredients"],
  ] as const)("rejects too many %s with invalid_value", (_, recipe, path) => {
    const result = validateRecipe(recipe);
    expect(result.ok).toBe(false);
    expect(result.errors).toContainEqual(expect.objectContaining({ path, code: "invalid_value" }));
  });

  it("rejects too many prep steps", () => {
    const recipe = { ...chain(1), prep: Array.from({ length: MAX_ITEMS + 1 }, (_, k) => ({ id: `p${k}`, action: "x" })) };
    expect(validateRecipe(recipe).errors).toEqual([expect.objectContaining({ path: "/prep", code: "invalid_value" })]);
  });

  it("rejects too many inputs on one step", () => {
    const recipe = chain(1);
    recipe.steps[0]!.inputs = Array.from({ length: MAX_ITEMS + 1 }, () => "i0");
    expect(validateRecipe(recipe).errors).toEqual([expect.objectContaining({ path: "/steps/0/inputs", code: "invalid_value" })]);
  });

  it("matches the limits in recipe.schema.json", () => {
    const check = new Ajv2020({ strict: false }).compile(schema);
    expect(check(chain(MAX_ITEMS))).toBe(true);
    expect(check(chain(MAX_ITEMS + 1))).toBe(false);
    expect(check(wide(MAX_ITEMS + 1))).toBe(false);
  });

  it("never throws on huge input, and returns quickly", () => {
    for (const recipe of [chain(100_000), wide(100_000)]) {
      expect(elapsed(() => expect(() => validateRecipe(recipe)).not.toThrow())).toBeLessThan(1000);
    }
  });
});

describe("layoutRecipe without validation", () => {
  it("lays out deep chains without running out of stack", () => {
    const grid = layoutRecipe(chain(20_000));
    expect(grid.columns).toBe(20_001);
    expect(grid.steps.at(-1)!.isRoot).toBe(true);
  });

  it("throws a clear error, instead of hanging, on a cycle or a reused input", () => {
    const cycle: Recipe = { ...chain(2), steps: [{ id: "a", action: "x", inputs: ["i0", "b"] }, { id: "b", action: "x", inputs: ["a"] }, { id: "c", action: "x", inputs: ["b"] }] };
    expect(() => layoutRecipe(cycle)).toThrow(/validateRecipe/);
    // Each step uses both previous steps: 2^40 paths if inputs were placed every time they are reached.
    const steps = [{ id: "a0", action: "x", inputs: ["i0"] }, { id: "b0", action: "x", inputs: ["i1"] }];
    for (let k = 1; k <= 40; k++) {
      steps.push({ id: `a${k}`, action: "x", inputs: [`a${k - 1}`, `b${k - 1}`] }, { id: `b${k}`, action: "x", inputs: [`a${k - 1}`, `b${k - 1}`] });
    }
    steps.push({ id: "end", action: "x", inputs: ["a40", "b40"] });
    const diamond: Recipe = { schemaVersion: 1, title: "d", ingredients: [{ id: "i0", name: "x" }, { id: "i1", name: "y" }], steps };
    expect(() => layoutRecipe(diamond)).toThrow(/validateRecipe/);
  });
});

describe("renderers with oversized recipes", () => {
  it("<RecipeTable> shows the error block instead of crashing", () => {
    render(<RecipeTable recipe={chain(5000)} />);
    expect(screen.getByRole("alert").textContent).toContain("at most");
  });

  it("<recipe-table> shows the error block instead of throwing", () => {
    defineRecipeTable();
    const el = document.createElement("recipe-table");
    document.body.append(el);
    expect(() => (el.recipe = chain(5000))).not.toThrow();
    expect(el.querySelector('[role="alert"]')!.textContent).toContain("at most");
  });
});
