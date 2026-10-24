import { describe, expect, it } from "vitest";
import { renderRecipeText } from "../src/core";
import { examples } from "./helpers";

describe("renderRecipeText", () => {
  it.each(examples)("draws $name", ({ recipe }) => {
    expect(renderRecipeText(recipe, { locale: "en-US" })).toMatchSnapshot();
  });

  it("labels a merged cell on the middle row of its span", () => {
    const pancakes = examples.find((e) => e.name === "pancakes.json")!.recipe;
    const lines = renderRecipeText(pancakes, { locale: "en-US" }).split("\n");
    const row = (text: string) => lines.find((l) => l.includes(text))!;
    expect(row("2 tbsp sugar")).toMatch(/\| whisk +\|/); // dry whisk spans rows 0-3
    expect(row("1½ cups / 360 ml milk")).toMatch(/\| whisk +\|/); // wet whisk spans rows 4-6
    expect(row("2 cups / 250 g flour")).not.toContain("whisk");
    expect(lines.filter((l) => l.startsWith("+")).every((l) => l.length === lines[3]!.length)).toBe(true);
  });
});
