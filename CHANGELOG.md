# Changelog

## 0.2.0 (unreleased)

Web Component.

- `<recipe-table>` custom element (`recipe-table/element`): the same markup and CSS as `RecipeTable`, without React. Light DOM, so tokens, part classes, `data-theme` and page CSS apply unchanged. Attributes `scale`, `view`, `locale`, `heading-level`; properties `recipe`, `labels`, `classNames`; a `recipe-error` event instead of `onError`.
- The recipe can sit in a `<script type="application/json">` inside the tag, so a page needs no script of its own. A `recipe` attribute logs a warning naming both supported ways.
- `recipe-table/element/define` (`dist/define.js`) registers the element on import; it is the default file on jsDelivr and unpkg, so one `<script type="module" src>` tag is enough.
- `recipeToInlineJson(recipe)` in `recipe-table/core` serializes a recipe for the inline script so that recipe text cannot end the script and inject HTML. Use it whenever a server embeds data it did not write.
- `custom-elements.json` describes the element (Custom Elements Manifest), referenced from `package.json`.
- React is now an optional peer dependency, so element-only installs do not pull it in.
- `recipe-table/core` gains `prepareRecipe`, `recipeText`, `partClass`, `safeHref` and `DEFAULT_LABELS`, shared by both renderers. `RecipeTableLabels` and `RecipeTablePart` are now exported from core too.
- Fix: the source link is only rendered for http, https and relative URLs, decided by the browser's URL parser, so variants such as `"java\nscript:"` are caught too. Other URLs are shown as text (React 18 did not block them).
- Fix: a recipe with a long chain of steps (about 2,500) passed validation and then crashed rendering with a stack overflow, taking down the React tree. Layout and cycle detection no longer recurse, and `validateRecipe` rejects more than `MAX_ITEMS` (1000) ingredients, steps, prep steps or inputs per step with `invalid_value`; the schema has matching `maxItems`. `layoutRecipe` on unvalidated data with a cycle or a reused input now throws a clear error instead of hanging.
- Docs: the first `AGENTS.md` example did not typecheck (JSON imports are not typed as `Recipe`); it now passes `validateRecipe`'s result. Tests now check the `AGENTS.md` code samples, lists and paths, the `llms.txt` links, and the README props table and CDN URLs.

## 0.1.0 (2026-10-24)

First minimal version.

- `RecipeTable` component and `useRecipeTable` hook.
- `recipe-table/core`: `validateRecipe`, `layoutRecipe`, `scaleRecipe`, `formatQuantity`, `formatDuration`, `renderRecipeText`.
- `recipe.schema.json` (schema version 1), `tokens.json`, `styles.css` (modern minimal theme, light and dark).
- CLI: `recipe-table validate` and `recipe-table preview`.
- Examples: Mapo Tofu, Vegetarian Luroufan, Pancakes, Banana Bread, plus one invalid recipe per main error code.
