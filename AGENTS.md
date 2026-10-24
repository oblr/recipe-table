# recipe-table: guide for AI coding agents

This file ships inside the npm package (`node_modules/recipe-table/AGENTS.md`) so you can use the
library correctly without web access. Everything below is checked by the package's tests.

## Render a recipe

```tsx
import { RecipeTable, validateRecipe } from "recipe-table";
import "recipe-table/styles.css"; // forget this and the table renders unstyled (still readable)
import recipe from "./pancakes.json";

const result = validateRecipe(recipe);
if (!result.ok) console.error(result.errors); // fix the data and retry

export default function Page() {
  return <RecipeTable recipe={recipe} />;
}
```

Only `recipe` is required. Other props: `scale`, `view` ("auto" | "table" | "list"), `locale`,
`labels`, `headingLevel`, `className`, `classNames`, `style`, `onError`. Types and JSDoc:
`dist/index.d.ts`.

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

In code: `renderRecipeText(recipe)` from `recipe-table/core` returns the same ASCII table.

## Restyle

- Do not use `!important`; the shipped CSS is in `@layer recipe-table` with zero-specificity
  selectors, so any normal rule wins.
- Prefer tokens: set `--rt-*` custom properties on any ancestor. Full list with defaults and
  purpose: `tokens.json` (`tokens`), plus every part class and data attribute (`parts`).
- Dark mode: `prefers-color-scheme`, or `data-theme="dark" | "light"` on an ancestor.
- Utility-class users: `classNames={{ step: "...", quantity: "..." }}`.
- Fully custom markup: `useRecipeTable(recipe, { scale })` returns `{ ok, grid }`; see `Grid` in
  `dist/core.d.ts`.
