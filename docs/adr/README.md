# Architecture decision records

Decided 2026-10-24 in the design doc review. One line each; expand into a full record (context, decision, alternatives, consequences) when a decision is revisited.

| ADR | Decision | Status |
| --- | --- | --- |
| 001 | Recipe data is flat: ingredients and steps in lists, steps reference inputs by id; a validator enforces the tree rules. | Accepted |
| 002 | The grid is derived, never stored: `layoutRecipe()` assigns a step's column as one right of its deepest input; shallower inputs stretch with `colSpan`. | Accepted |
| 003 | Styling is plain CSS in `@layer recipe-table` with `:where()` selectors and `--rt-*` tokens; token names and part classes are public API. Default look: modern minimal. | Accepted |
| 004 | Markup is a real `<table>` (`th[scope=row]`, `td[headers]`) plus an ordered step list for screen readers and narrow screens. `view="auto"` switches with a CSS container query (36rem). | Accepted |
| 005 | React 18/19 is the only peer dependency (optional since 0.2, for element-only installs); no runtime dependencies; a React-free `core` entry. The `<recipe-table>` Web Component shipped in 0.2. | Accepted |
| 006 | `recipe.schema.json` is the data contract. Types are hand-written to match for now; a test checks examples against both. | Accepted (generation deferred) |
| 007 | Agent docs (`AGENTS.md`, `llms.txt`, `tokens.json`, examples) ship inside the npm package. | Accepted |
| 008 | The package never calls an LLM; free-text conversion is the app's job. | Accepted |
| 009 | Quantities are numbers plus canonical unit codes; volume-to-mass only through a source-given `alt`. | Accepted |
| 010 | Invalid input renders an error block and calls `onError`; never a partial table. | Accepted |
| 011 | Split ingredients ("divided") are two ingredient rows in schema v1. A `split` step with several outputs is planned for schema v2, to be decided. | Accepted for v1; v2 open |
| 012 | Steps after the final merge ("cool", "garnish") chain as single-input steps after it. | Accepted |
| 013 | v1 has no built-in scale or unit buttons: `scale` (and later `units`) are props; an optional `<RecipeControls>` may follow in v1.x. | Accepted |
| 014 | Browser floor: 2023-era evergreen browsers (`@layer`, `:where()`, `color-mix()`, container queries). | Accepted |
| 015 | Licence MIT; README credits Michael Chu for the notation. | Accepted |
| 016 | `<recipe-table>` renders into the light DOM, not a shadow root, so ADR 003's styling API (tokens, part classes, `data-theme`, page CSS, `classNames`) works unchanged. Its markup equals `RecipeTable`'s; a test compares them for every example. | Accepted 2026-10-26 |
| 017 | The element takes its recipe from the `recipe` property or a `<script type="application/json">` child, read once on connect; never from an attribute (a warning says so). No `src` URL: the package does no network access. | Accepted 2026-10-26 |
