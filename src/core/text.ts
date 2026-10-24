import { formatDuration, formatQuantity, formatTemperature, scaleRecipe, type FormatOptions } from "./format";
import { layoutRecipe, type GridCell } from "./layout";
import type { Ingredient, PrepStep, Recipe, Step } from "./types";

/** "115 g butter, softened (optional)" */
export function ingredientLabel(ing: Ingredient, options: FormatOptions = {}): string {
  const qty = ing.quantity ? `${formatQuantity(ing.quantity, options)} ` : "";
  return `${qty}${ing.name}${ing.note ? `, ${ing.note}` : ""}${ing.optional ? " (optional)" : ""}`;
}

/** "bake, 1 h, 180 °C, until golden" */
export function stepLabel(step: Step | PrepStep): string {
  const parts = [step.action];
  if ("duration" in step && step.duration) parts.push(formatDuration(step.duration));
  if (step.temperature) parts.push(formatTemperature(step.temperature));
  if (step.note) parts.push(step.note);
  return parts.join(", ");
}

const label = (cell: GridCell, options: FormatOptions) =>
  cell.kind === "ingredient" ? ingredientLabel(cell.ingredient, options) : stepLabel(cell.step);

/**
 * Draw a VALID recipe as a plain-text table, for terminals, tests and agents that cannot see a
 * browser. Same layout as the React component.
 *
 * @example
 * console.log(renderRecipeText(pancakes));
 * // +---------------+-------+---------------+
 * // | 2 cups flour  | whisk | fold together |
 * // ...
 */
export function renderRecipeText(recipe: Recipe, options: FormatOptions & { scale?: number } = {}): string {
  const grid = layoutRecipe(scaleRecipe(recipe, options.scale ?? 1));
  const cells = [...grid.ingredients, ...grid.steps];
  const labels = new Map(cells.map((c) => [c, label(c, options)]));

  const widths = Array.from({ length: grid.columns }, () => 3);
  for (const c of cells) if (c.colSpan === 1) widths[c.col] = Math.max(widths[c.col]!, labels.get(c)!.length);
  for (const c of cells) {
    if (c.colSpan === 1) continue;
    const span = widths.slice(c.col, c.col + c.colSpan);
    const room = span.reduce((a, b) => a + b, 0) + 3 * (c.colSpan - 1);
    const need = labels.get(c)!.length;
    if (need > room) widths[c.col + c.colSpan - 1]! += need - room;
  }
  const x = [0];
  for (const w of widths) x.push(x.at(-1)! + w + 3);

  const height = 2 * grid.rows.length + 1;
  const canvas = Array.from({ length: height }, () => Array.from({ length: x.at(-1)! + 1 }, () => " "));
  const put = (line: number, col: number, ch: string) => {
    const row = canvas[line]!;
    if (row[col] === "+") return;
    row[col] = row[col] !== " " && row[col] !== ch && ch !== " " ? "+" : ch;
  };
  for (const c of cells) {
    const x0 = x[c.col]!;
    const x1 = x[c.col + c.colSpan]!;
    const y0 = 2 * c.row;
    const y1 = 2 * (c.row + c.rowSpan);
    for (let i = x0; i <= x1; i++) {
      put(y0, i, i === x0 || i === x1 ? "+" : "-");
      put(y1, i, i === x0 || i === x1 ? "+" : "-");
    }
    for (let j = y0 + 1; j < y1; j++) {
      put(j, x0, "|");
      put(j, x1, "|");
    }
    const line = y0 + 1 + 2 * Math.floor((c.rowSpan - 1) / 2);
    [...labels.get(c)!].forEach((ch, i) => (canvas[line]![x0 + 2 + i] = ch));
  }

  const out: string[] = [recipe.title];
  const meta: string[] = [];
  const scaled = options.scale && recipe.yield ? recipe.yield.amount * options.scale : recipe.yield?.amount;
  if (recipe.yield) meta.push(`${scaled} ${recipe.yield.unit}`);
  if (recipe.time?.total) meta.push(formatDuration(recipe.time.total));
  if (meta.length) out.push(meta.join(" · "));
  out.push("");
  for (const p of grid.prep) out.push(`Prep: ${stepLabel(p)}`);
  if (grid.prep.length) out.push("");
  out.push(...canvas.map((row) => row.join("").trimEnd()));
  if (recipe.source) {
    const s = recipe.source;
    out.push("", `Source: ${[s.author, s.name, s.url].filter(Boolean).join(" · ")}`);
  }
  return out.join("\n");
}
