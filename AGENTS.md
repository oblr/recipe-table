# recipe-table: guide for AI coding agents

This file ships inside the npm package (`node_modules/recipe-table/AGENTS.md`) so you can use the
library correctly without web access. Everything below is checked by the package's tests.

## Render a recipe

```tsx
import { RecipeTable, validateRecipe } from "recipe-table";
import "recipe-table/styles.css"; // forget this and the table renders unstyled (still readable)
import data from "./pancakes.json";

// JSON imports are typed loosely (unit: string), so pass the recipe validateRecipe returns.
const result = validateRecipe(data);
if (!result.ok) console.error(result.errors); // fix the data and retry

export default function Page() {
  return result.ok ? <RecipeTable recipe={result.recipe} /> : null;
}
```

Only `recipe` is required. Other props: `scale`, `view` ("auto" | "table" | "list"), `locale`,
`labels`, `headingLevel`, `className`, `classNames`, `style`, `onError`. Types and JSDoc:
`dist/index.d.ts`.

## Render without React

`<recipe-table>` is a custom element with the same markup and CSS as `RecipeTable`, for plain HTML,
Vue, Svelte, Angular and CMS pages. In React, use `RecipeTable` instead.

The simplest form needs no script of your own: two tags load the CSS and register the element, and
the recipe JSON goes inside the tag.

```html
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/recipe-table@0.2/styles.css" />
<script type="module" src="https://cdn.jsdelivr.net/npm/recipe-table@0.2/dist/define.js"></script>

<recipe-table scale="2" locale="en-US">
  <script type="application/json">
    {
      "schemaVersion": 1,
      "title": "Vinaigrette",
      "ingredients": [
        { "id": "oil", "name": "olive oil", "quantity": { "value": 3, "unit": "tbsp" } },
        { "id": "vinegar", "name": "red wine vinegar", "quantity": { "value": 1, "unit": "tbsp" } },
        { "id": "salt", "name": "salt", "quantity": { "value": 1, "unit": "pinch", "scalable": false } }
      ],
      "steps": [{ "id": "shake", "action": "shake in a jar", "inputs": ["oil", "vinegar", "salt"] }]
    }
  </script>
</recipe-table>
```

With a bundler, register the element and load the CSS from your entry file instead
(`import "recipe-table/element/define"` also registers it):

```ts
import { defineRecipeTable } from "recipe-table/element";
import "recipe-table/styles.css";
import data from "./pancakes.json";

defineRecipeTable(); // registers <recipe-table>; safe to call twice, a no-op on the server

// Or set the recipe from code. It is a property: there is no recipe attribute.
const el = document.querySelector("recipe-table")!;
el.recipe = data; // any value; the element validates it like inline JSON
document.addEventListener("recipe-error", (e) => console.error(e.detail.errors));
```

- Attributes: `scale`, `view`, `locale`, `heading-level`. Each is also a property (`headingLevel`).
- Properties only: `recipe`, `labels`, `classNames`. Objects never go in attributes; a `recipe`
  attribute is ignored with a console warning.
- Invalid data renders the error block and fires `recipe-error` (bubbles; `detail.errors` holds the
  same error objects as `validateRecipe`). Unparseable inline JSON reports `invalid_type` at path "".
- Inline JSON is read once, when the element connects (or once the page has finished parsing);
  later changes go through `el.recipe`. Write `<` as `\u003c` inside JSON strings: a literal
  `</script>` in recipe text would end the script early.
- It renders nothing until it has a recipe, renders in the browser only (no server HTML), and
  replaces anything inside the tag.
- Frameworks: Vue needs `compilerOptions.isCustomElement: (tag) => tag === "recipe-table"`, then
  `:recipe="data"`. Svelte: `recipe={data}`. Angular: add `CUSTOM_ELEMENTS_SCHEMA`, then
  `[recipe]="data"`. Each sets the property, not an attribute.
- Machine-readable description (attributes, properties, event, CSS tokens): `custom-elements.json`.
  Types: `dist/element.d.ts`.

## Produce recipe data

- Schema: `recipe.schema.json` (JSON Schema 2020-12). Use it directly as an LLM structured-output
  schema or tool input schema.
- Working examples: `examples/*.json`. Broken examples, named after the error code they produce:
  `examples/invalid/*.json`.
- Rules the schema cannot express (always run `validateRecipe`):
  1. Ids are unique across ingredients, steps and prep steps.
  2. Every ingredient and every step except the last is in exactly one step's `inputs`.
  3. Exactly one step is not an input of any other: the finished dish.
  4. No cycles. Prep steps cannot be inputs.
  5. At most 1000 ingredients, 1000 steps, 1000 prep steps, and 1000 inputs per step (`MAX_ITEMS`;
     also `maxItems` in the schema). Larger input is rejected with `invalid_value`.
- Quantities are numbers (`0.5`, not `"1/2"`); units are canonical codes (`"cup"`, not `"cups"`).
  Unknown units: use `"piece"` and put the description in `name`.
- Do not invent: `alt` units, temperatures and times only when the source states them.
- An ingredient used twice ("divided") becomes two ingredients with different ids and notes.
- Steps after the final merge ("cool", "garnish") chain as single-input steps.

Error objects look like `{ path: "/steps/2/inputs/0", code: "unknown_input", message, hint }`.
`code` values are stable: invalid_type, missing_field, unknown_field, unsupported_schema_version,
invalid_value, invalid_unit, invalid_duration, duplicate_id, empty_inputs, unknown_input,
self_input, input_reused, ingredient_unused, multiple_roots, no_root, cycle.

## Check the layout without a browser

```sh
npx recipe-table validate recipe.json           # add --json for machine-readable output
npx recipe-table preview recipe.json --scale 2  # prints the table as ASCII
```

In code: `renderRecipeText(recipe)` from `recipe-table/core` returns the same ASCII table. In a
jsdom test, the element renders synchronously: call `defineRecipeTable()`, append the element, set
`recipe`, then read `el.innerHTML`.

## Restyle

- Do not use `!important`; the shipped CSS is in `@layer recipe-table` with zero-specificity
  selectors, so any normal rule wins.
- Prefer tokens: set `--rt-*` custom properties on any ancestor (or `<recipe-table>` itself). Full list with defaults and
  purpose: `tokens.json` (`tokens`), plus every part class and data attribute (`parts`).
- Dark mode: `prefers-color-scheme`, or `data-theme="dark" | "light"` on an ancestor.
- Utility-class users: `classNames={{ step: "...", quantity: "..." }}` (element: the `classNames`
  property).
- Fully custom markup: `useRecipeTable(recipe, { scale })` returns `{ ok, grid }`; see `Grid` in
  `dist/core.d.ts`.
