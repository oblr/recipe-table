import Ajv2020 from "ajv/dist/2020";
import { describe, expect, it } from "vitest";
import schema from "../recipe.schema.json";
import { validateRecipe } from "../src/core";
import { example, examples, invalidExamples } from "./helpers";

const ajv = new Ajv2020({ allErrors: true, strict: false });
const schemaCheck = ajv.compile(schema);

describe("validateRecipe", () => {
  it.each(examples)("accepts $name", ({ recipe }) => {
    const result = validateRecipe(recipe);
    expect(result.errors).toEqual([]);
    expect(result.ok).toBe(true);
  });

  it.each(invalidExamples)("rejects $name with code $code", ({ data, code }) => {
    const result = validateRecipe(data);
    expect(result.ok).toBe(false);
    expect(result.errors.map((e) => e.code)).toContain(code);
  });

  it("points at the offending input and lists known ids", () => {
    const result = validateRecipe(invalidExamples.find((e) => e.code === "unknown_input")!.data);
    const error = result.errors.find((e) => e.code === "unknown_input")!;
    expect(error.path).toBe("/steps/0/inputs/1");
    expect(error.message).toBe('Step "mix" uses "c", which does not exist.');
    expect(error.hint).toContain("a, b, mix");
  });

  it("reports unknown fields with the allowed ones", () => {
    const recipe = { ...example("pancakes"), servings: 4 };
    const result = validateRecipe(recipe);
    expect(result.errors).toMatchObject([{ path: "/servings", code: "unknown_field" }]);
  });

  it("reports duplicate ids across ingredients and steps", () => {
    const recipe = example("pancakes");
    const result = validateRecipe({ ...recipe, steps: [...recipe.steps.slice(0, 3), { ...recipe.steps[3]!, id: "flour" }] });
    expect(result.errors.map((e) => e.code)).toContain("duplicate_id");
  });

  it("rejects prep steps used as inputs", () => {
    const recipe = example("banana-bread");
    const steps = recipe.steps.map((s) => (s.id === "bake" ? { ...s, inputs: ["fold", "preheat"] } : s));
    expect(validateRecipe({ ...recipe, steps }).errors[0]).toMatchObject({ code: "unknown_input", path: "/steps/7/inputs/1" });
  });

  it("rejects bad durations", () => {
    const recipe = example("pancakes");
    const steps = recipe.steps.map((s) => (s.id === "cook" ? { ...s, duration: "2 min" } : s));
    expect(validateRecipe({ ...recipe, steps }).errors[0]).toMatchObject({ code: "invalid_duration" });
  });

  it("never throws on garbage", () => {
    for (const junk of [null, 1, "x", [], { schemaVersion: 2 }, { steps: [null], ingredients: [1] }]) {
      expect(() => validateRecipe(junk)).not.toThrow();
      expect(validateRecipe(junk).ok).toBe(false);
    }
  });
});

describe("recipe.schema.json", () => {
  it.each(examples)("accepts $name", ({ recipe }) => {
    expect(schemaCheck(recipe), JSON.stringify(schemaCheck.errors)).toBe(true);
  });

  it("rejects what the validator rejects structurally", () => {
    expect(schemaCheck(invalidExamples.find((e) => e.code === "invalid_value")!.data)).toBe(false);
    expect(schemaCheck({ ...example("pancakes"), servings: 4 })).toBe(false);
  });
});
