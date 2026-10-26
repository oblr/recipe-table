import { afterEach, describe, expect, it } from "vitest";
import { recipeToInlineJson, type Recipe } from "../src/core";
import { defineRecipeTable } from "../src/element";
import { example } from "./helpers";

afterEach(() => document.body.replaceChildren());

// What a server does: put recipe data it did not write into the page as inline JSON.
const page = (json: string) => `<recipe-table><script type="application/json">${json}</script></recipe-table>`;

const hostile: Recipe = {
  ...example("pancakes"),
  title: '</script><img src=x onerror="alert(1)"><script>',
  description: "<!--<script> & </SCRIPT > ]]>",
};

describe("recipeToInlineJson", () => {
  it("is what makes it safe: plain JSON.stringify lets recipe text inject markup", () => {
    document.body.innerHTML = page(JSON.stringify(hostile));
    expect(document.querySelector("img[onerror]")).not.toBeNull();
  });

  it("keeps hostile strings inside the script, and the element reads them back unchanged", () => {
    defineRecipeTable();
    document.body.innerHTML = page(recipeToInlineJson(hostile));
    expect(document.querySelector("img")).toBeNull();
    expect(document.body.children).toHaveLength(1);
    const el = document.querySelector("recipe-table")!;
    expect(el.recipe).toEqual(hostile);
    expect(el.querySelector(".rt-title")!.textContent).toBe(hostile.title);
  });

  it("only escapes <, > and &", () => {
    expect(recipeToInlineJson({ a: "<b> & é" })).toBe('{"a":"\\u003cb\\u003e \\u0026 é"}');
    expect(JSON.parse(recipeToInlineJson(hostile))).toEqual(hostile);
    expect(recipeToInlineJson(undefined)).toBe("null");
  });
});
