import { render } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { RecipeTable, type Recipe } from "../src";
import tokens from "../tokens.json";
import { example, invalidExamples } from "./helpers";

const css = readFileSync(join(__dirname, "..", "styles.css"), "utf8");

describe("tokens.json", () => {
  it("lists exactly the tokens styles.css reads", () => {
    const used = new Set([...css.matchAll(/var\((--rt-[a-z-]+)/g)].map((m) => m[1]));
    expect(new Set(tokens.tokens.map((t) => t.name))).toEqual(used);
  });

  it("lists exactly the part classes the component renders", () => {
    const recipe: Recipe = { ...example("banana-bread"), description: "x", source: { name: "x" } };
    const { container } = render(
      <>
        <RecipeTable recipe={recipe} />
        <RecipeTable recipe={invalidExamples[0]!.data as Recipe} />
      </>,
    );
    const rendered = new Set(
      [...container.querySelectorAll("[class]")].flatMap((el) => [...el.classList]).filter((c) => c.startsWith("rt-")),
    );
    rendered.delete("rt-step-root"); // documented as a modifier of rt-step
    expect(new Set(tokens.parts.map((p) => p.class))).toEqual(rendered);
  });
});
