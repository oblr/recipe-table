import { cleanup, render } from "@testing-library/react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { RecipeTable, type Recipe, type RecipeTableProps } from "../src";
import { defineRecipeTable, RecipeTableElement } from "../src/element";
import { example, examples, invalidExamples } from "./helpers";

beforeAll(() => defineRecipeTable());
afterEach(() => {
  cleanup();
  document.body.replaceChildren();
});

/** Replace the generated id prefix (React's useId, the element's counter) with "ID". */
function normalize(html: string): string {
  const prefix = /id="([^"]+)-title"/.exec(html)?.[1];
  return prefix ? html.split(prefix).join("ID") : html;
}

function renderReact(props: RecipeTableProps): string {
  const { container } = render(<RecipeTable {...props} />);
  return normalize(container.innerHTML);
}

function renderElement({ recipe, scale, view, locale, headingLevel, labels, classNames }: RecipeTableProps): RecipeTableElement {
  const el = document.createElement("recipe-table");
  if (scale !== undefined) el.scale = scale;
  if (view !== undefined) el.view = view;
  if (locale !== undefined) el.locale = locale;
  if (headingLevel !== undefined) el.headingLevel = headingLevel;
  el.labels = labels;
  el.classNames = classNames;
  el.recipe = recipe;
  document.body.append(el);
  return el;
}

const variants: [string, Partial<RecipeTableProps>][] = [
  ["defaults", {}],
  ["scaled, list view, German", { scale: 2, view: "list", locale: "de-DE", headingLevel: 3 }],
  ["custom labels and classNames", { labels: { steps: "Schritte", stepResult: (n) => `Ergebnis ${n}` }, classNames: { step: "bg-amber-100", root: "r" } }],
];

describe("<recipe-table> matches <RecipeTable>", () => {
  for (const { name, recipe } of examples) {
    for (const [variant, props] of variants) {
      it(`${name}, ${variant}`, () => {
        const all = { locale: "en-US", ...props, recipe };
        expect(normalize(renderElement(all).innerHTML)).toBe(renderReact(all));
      });
    }
  }

  for (const { name, data } of invalidExamples) {
    it(`invalid/${name}`, () => {
      const props = { recipe: data as Recipe, view: "table" as const };
      expect(normalize(renderElement(props).innerHTML)).toBe(renderReact(props));
    });
  }

  it("with prep, optional ingredients, notes and source", () => {
    const recipe: Recipe = {
      ...example("mapo-tofu"),
      description: "Numbing and hot.",
      source: { name: "Example Kitchen", url: "https://example.com/mapo", author: "A. Cook" },
    };
    expect(normalize(renderElement({ recipe }).innerHTML)).toBe(renderReact({ recipe }));
  });

  it("without linking unsafe source URLs", () => {
    const recipe: Recipe = { ...example("pancakes"), source: { name: "Evil", url: "javascript:alert(1)" } };
    const html = renderReact({ recipe });
    expect(html).not.toContain("<a ");
    expect(html).toContain("Source: Evil");
    expect(normalize(renderElement({ recipe }).innerHTML)).toBe(html);
  });
});

describe("<recipe-table>", () => {
  it("renders from attributes and re-renders when they change", () => {
    document.body.innerHTML = `<recipe-table scale="2" view="list" heading-level="4" locale="en-US"></recipe-table>`;
    const el = document.querySelector("recipe-table")!;
    expect(el.innerHTML).toBe("");
    el.recipe = example("mapo-tofu");
    expect(el.querySelector("h4")!.textContent).toBe("Mapo Tofu");
    expect(el.querySelector(".rt-root")!.getAttribute("data-view")).toBe("list");
    expect(el.textContent).toContain("800 g");
    el.setAttribute("scale", "1");
    expect(el.textContent).toContain("400 g");
    expect(el.scale).toBe(1);
  });

  it("falls back to defaults for bad attribute values", () => {
    document.body.innerHTML = `<recipe-table scale="half" view="grid" heading-level="1"></recipe-table>`;
    const el = document.querySelector("recipe-table")!;
    expect([el.scale, el.view, el.headingLevel]).toEqual([1, "auto", 2]);
  });

  it("fires recipe-error once per new recipe or scale", () => {
    const onError = vi.fn();
    const data = invalidExamples.find((e) => e.code === "multiple_roots")!.data as Recipe;
    const el = document.createElement("recipe-table");
    document.body.addEventListener("recipe-error", (e) => onError(e.detail.errors));
    document.body.append(el);
    el.recipe = data;
    el.view = "table";
    el.labels = { errorTitle: "Kaputt" };
    expect(onError).toHaveBeenCalledTimes(1);
    expect(onError.mock.calls[0]![0][0].code).toBe("multiple_roots");
    expect(el.querySelector('[role="alert"] .rt-error')!.textContent).toBe("Kaputt");
    el.scale = 2;
    expect(onError).toHaveBeenCalledTimes(2);
    el.recipe = example("pancakes");
    el.recipe = data;
    expect(onError).toHaveBeenCalledTimes(3);
  });

  it("keeps properties set before the element was defined", () => {
    const el = document.createElement("late-recipe-table") as RecipeTableElement;
    (el as { recipe?: Recipe }).recipe = example("pancakes");
    document.body.append(el);
    defineRecipeTable("late-recipe-table");
    expect(el.querySelector("table")).toBeTruthy();
    expect(el.recipe).toBe(example("pancakes"));
  });

  it("renders nothing while detached and on recipe = undefined", () => {
    const el = document.createElement("recipe-table");
    el.recipe = example("pancakes");
    expect(el.childNodes).toHaveLength(0);
    document.body.append(el);
    expect(el.querySelector("table")).toBeTruthy();
    el.recipe = undefined;
    expect(el.childNodes).toHaveLength(0);
  });

  it("reads the recipe from an inline JSON script", () => {
    const recipe = example("pancakes");
    document.body.innerHTML = `<recipe-table locale="en-US"><script type="application/json">${JSON.stringify(recipe)}</script></recipe-table>`;
    const el = document.querySelector("recipe-table")!;
    expect(el.querySelector("script")).toBeNull();
    expect(normalize(el.innerHTML)).toBe(renderReact({ recipe, locale: "en-US" }));
    // Moving the element keeps the recipe even though the script is gone.
    document.body.append(document.createElement("div"));
    document.body.lastElementChild!.append(el);
    expect(el.querySelector("table")).toBeTruthy();
  });

  it("reports inline JSON that does not parse", () => {
    const onError = vi.fn();
    document.addEventListener("recipe-error", (e) => onError(e.detail.errors), { once: true });
    document.body.innerHTML = `<recipe-table><script type="application/json">{ "title": "x", }</script></recipe-table>`;
    const el = document.querySelector("recipe-table")!;
    expect(onError).toHaveBeenCalledTimes(1);
    expect(onError.mock.calls[0]![0][0]).toMatchObject({ path: "", code: "invalid_type" });
    expect(el.querySelector('[role="alert"]')!.textContent).toContain("not valid JSON");
    el.recipe = example("pancakes");
    expect(el.querySelector("table")).toBeTruthy();
  });

  it("warns that a recipe attribute is ignored", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    document.body.innerHTML = `<recipe-table recipe='{"title":"x"}'></recipe-table>`;
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('"recipe" attribute is ignored'));
    expect(document.querySelector("recipe-table")!.childNodes).toHaveLength(0);
    warn.mockRestore();
  });

  it("can be defined more than once", () => {
    expect(() => defineRecipeTable()).not.toThrow();
    expect(customElements.get("recipe-table")).toBe(RecipeTableElement);
  });
});
