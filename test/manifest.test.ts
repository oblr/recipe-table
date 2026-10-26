import { describe, expect, it, vi } from "vitest";
import manifest from "../custom-elements.json";
import pkg from "../package.json";
import tokens from "../tokens.json";
import * as element from "../src/element";
import { invalidExamples } from "./helpers";

const [module] = manifest.modules;
const cls = module!.declarations.find((d) => d.kind === "class")!;
const accessors = (proto: object) =>
  Object.entries(Object.getOwnPropertyDescriptors(proto))
    .filter(([, d]) => d.set)
    .map(([name]) => name);

describe("custom-elements.json", () => {
  it("is shipped and declared", () => {
    expect(pkg.customElements).toBe("custom-elements.json");
    expect(pkg.files).toContain("custom-elements.json");
    expect(module!.path).toBe("dist/element.js");
  });

  it("lists exactly the observed attributes, each with the property it reflects", () => {
    expect(cls.attributes!.map((a) => a.name)).toEqual(element.RecipeTableElement.observedAttributes);
    for (const a of cls.attributes!) expect(accessors(element.RecipeTableElement.prototype)).toContain(a.fieldName);
  });

  it("lists exactly the public properties", () => {
    expect(new Set(cls.members!.map((m) => m.name))).toEqual(new Set(accessors(element.RecipeTableElement.prototype)));
  });

  it("names the event the element fires", () => {
    element.defineRecipeTable();
    const el = document.createElement("recipe-table");
    const listener = vi.fn();
    el.addEventListener(cls.events![0]!.name, listener);
    document.body.append(el);
    el.recipe = invalidExamples[0]!.data as never;
    expect(listener).toHaveBeenCalledTimes(1);
    el.remove();
  });

  it("lists the same CSS tokens as tokens.json", () => {
    expect(cls.cssProperties).toEqual(tokens.tokens.map((t) => ({ name: t.name, description: t.purpose, default: t.default })));
  });

  it("lists exactly the module's exports", () => {
    const js = module!.exports.filter((e) => e.kind === "js").map((e) => e.name);
    expect(new Set(js)).toEqual(new Set(Object.keys(element)));
    expect(module!.exports.find((e) => e.kind === "custom-element-definition")!.name).toBe(cls.tagName);
  });
});
