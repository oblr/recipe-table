import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { Recipe } from "../src/core";

const dir = join(__dirname, "..", "examples");
export const readJson = (path: string): unknown => JSON.parse(readFileSync(path, "utf8"));
export const examples = readdirSync(dir)
  .filter((f) => f.endsWith(".json"))
  .map((f) => ({ name: f, recipe: readJson(join(dir, f)) as Recipe }));
export const invalidExamples = readdirSync(join(dir, "invalid")).map((f) => ({
  name: f,
  code: f.replace(".json", ""),
  data: readJson(join(dir, "invalid", f)),
}));
export const example = (name: string) => examples.find((e) => e.name === `${name}.json`)!.recipe;
