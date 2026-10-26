# recipe-table

Render recipes as **tabular recipes** in React or as a Web Component: ingredients are rows, steps are columns, and each step spans exactly the ingredients it combines. Reading left to right, the table narrows until one cell is left: the dish.

```
+-----------------------+-------+-------------------------------------+-----------------------------------------+
| 2 cups / 250 g flour  |       |                                     |                                         |
+-----------------------+       |                                     |                                         |
| 2 tbsp sugar          | whisk |                                     |                                         |
+-----------------------+       |                                     |                                         |
| 2 tsp baking powder   |       |                                     |                                         |
+-----------------------+       |                                     |                                         |
| ½ tsp salt            |       | fold together, a few lumps are fine | cook, 2 min, per side, on a hot griddle |
+-----------------------+-------+                                     |                                         |
| 2 eggs                |       |                                     |                                         |
+-----------------------+       |                                     |                                         |
| 1½ cups / 360 ml milk | whisk |                                     |                                         |
+-----------------------+       |                                     |                                         |
| 3 tbsp butter, melted |       |                                     |                                         |
+-----------------------+-------+-------------------------------------+-----------------------------------------+
```

The notation was invented by Michael Chu at [Cooking for Engineers](https://www.cookingforengineers.com/). This package is an independent implementation.

- One component, one required prop, zero runtime dependencies (React 18 or 19 as a peer).
- A `<recipe-table>` custom element for pages without React: same markup, same CSS.
- Styling is plain, optional CSS in a cascade layer, driven by `--rt-*` custom properties. Your CSS always wins.
- Recipe data is plain JSON with a [JSON Schema](./recipe.schema.json) and a validator whose errors explain how to fix them.
- Accessible: a real `<table>` with row headers and `headers` associations, plus an ordered step list for screen readers and narrow screens.

> Status: 0.1, first minimal version. The API may change before 1.0.

## Install

```sh
npm install recipe-table
```

## Use

```tsx
import { RecipeTable } from "recipe-table";
import "recipe-table/styles.css"; // optional

<RecipeTable recipe={recipe} />;
```

| Prop | Type | Default | |
| --- | --- | --- | --- |
| `recipe` | `Recipe` | required | Validated on every change. Invalid data renders an error block, never a wrong table. |
| `scale` | `number` | `1` | Multiplies quantities and yield. Durations and temperatures never scale. |
| `view` | `"auto" \| "table" \| "list"` | `"auto"` | `auto` switches to the step list when the component is narrower than 36rem. |
| `locale` | `string` | runtime | Number formatting, e.g. `"de-DE"`. |
| `labels` | `Partial<RecipeTableLabels>` | English | UI strings and unit names. Recipe text is never translated. |
| `headingLevel` | `2–6` | `2` | Level of the title heading. |
| `className`, `style` | | | On the root. `style` accepts tokens: `{ "--rt-radius": 0 }`. |
| `classNames` | `Partial<Record<RecipeTablePart, string>>` | | Extra classes per part, e.g. for Tailwind. |
| `onError` | `(errors) => void` | | Called once per invalid recipe. |

## Recipe format

A recipe is a flat list of ingredients and steps. Steps name their inputs by id. Every ingredient and every step except the last is used by exactly one step; the last step is the finished dish.

```json
{
  "schemaVersion": 1,
  "title": "Pancakes",
  "yield": { "amount": 4, "unit": "servings" },
  "ingredients": [
    { "id": "flour", "name": "flour", "quantity": { "value": 2, "unit": "cup", "alt": [{ "value": 250, "unit": "g" }] } },
    { "id": "eggs", "name": "eggs", "quantity": { "value": 2 } },
    { "id": "milk", "name": "milk", "quantity": { "value": 1.5, "unit": "cup" } }
  ],
  "steps": [
    { "id": "whisk", "action": "whisk", "inputs": ["eggs", "milk"] },
    { "id": "fold", "action": "fold together", "inputs": ["flour", "whisk"] },
    { "id": "cook", "action": "cook", "inputs": ["fold"], "duration": "PT2M", "note": "per side" }
  ]
}
```

- Quantities are numbers (`0.5`, not `"1/2"`) with a canonical unit code; ranges are `[min, max]`.
- `alt` holds the source's second unit. It is never computed.
- `"scalable": false` keeps an amount fixed when scaling (a pinch of salt).
- Steps with no ingredients ("Preheat the oven") go in `prep`.
- An ingredient used in two places ("1 cup sugar, divided") is listed twice with different ids.
- Durations are ISO 8601: `"PT1H15M"`.

Full reference: [`recipe.schema.json`](./recipe.schema.json). Examples: [`examples/`](./examples).

```ts
import { validateRecipe } from "recipe-table";

const result = validateRecipe(json);
if (!result.ok) console.error(result.errors);
// [{ path: "/steps/0/inputs/1", code: "unknown_input",
//    message: "Step \"mix\" uses \"c\", which does not exist.", hint: "Known ingredient and step ids: a, b, mix." }]
```

## Styling

Four levels, cheapest first:

1. **Tokens.** Set custom properties on any ancestor:
   ```css
   .my-recipes {
     --rt-font-family: "Inter", sans-serif;
     --rt-color-step-bg: oklch(95% 0.03 80);
     --rt-radius: 0;
   }
   ```
2. **Parts.** Every element has a stable class (`rt-ingredient`, `rt-step`, `rt-quantity`, ...) and state attributes (`data-depth`, `data-root`, `data-optional`). Style them with ordinary CSS; no `!important` needed.
3. **`classNames` prop** for utility classes: `classNames={{ step: "bg-amber-100" }}`.
4. **Unstyled.** Skip the CSS import for bare semantic HTML, or use `useRecipeTable()` and render your own markup.

Light and dark defaults follow `prefers-color-scheme`. Force one with `data-theme="light"` or `data-theme="dark"` on any ancestor. All tokens and parts: [`tokens.json`](./tokens.json).

## Without React

### `<recipe-table>` element

For plain HTML, Vue, Svelte, Angular or a CMS. The recipe JSON can go straight into the page:

```html
<recipe-table scale="2" locale="en-US">
  <script type="application/json">{ "schemaVersion": 1, "title": "Pancakes", ... }</script>
</recipe-table>
```

```js
import { defineRecipeTable } from "recipe-table/element";
import "recipe-table/styles.css";

defineRecipeTable(); // once
document.querySelector("recipe-table").recipe = recipe; // or set it from code
```

| | |
| --- | --- |
| Attributes | `scale`, `view`, `locale`, `heading-level` (also properties; `headingLevel`) |
| Properties only | `recipe`, `labels`, `classNames`. There is no `recipe` attribute. |
| Event | `recipe-error`, bubbles, `event.detail.errors` |

It renders in the light DOM, so styling works exactly as above: tokens on any ancestor or on the element, part classes, `data-theme`. Vue needs `isCustomElement` for the tag; Angular needs `CUSTOM_ELEMENTS_SCHEMA`. Full description: [`custom-elements.json`](./custom-elements.json).

### Core and CLI

`recipe-table/core` has everything except the components: `validateRecipe`, `layoutRecipe`, `scaleRecipe`, `formatQuantity`, `renderRecipeText`.

```sh
npx recipe-table validate my-recipe.json
npx recipe-table preview my-recipe.json --scale 2
```

## Develop

```sh
npm install
npm test          # vitest
npm run dev       # visual test bench (all examples, themes, views, widths)
npm run build
```

## Licence

MIT. Recipe-table notation by Michael Chu.
