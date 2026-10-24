import type { Ingredient, PrepStep, Recipe, Step } from "./types";

export interface IngredientCell {
  kind: "ingredient";
  id: string;
  /** 0-based row in the grid (prep rows not counted). */
  row: number;
  /** Always 0: ingredients sit in the first column. */
  col: 0;
  rowSpan: 1;
  /** Stretches right across empty step columns until the step that uses it. */
  colSpan: number;
  ingredient: Ingredient;
}

export interface StepCell {
  kind: "step";
  id: string;
  row: number;
  /** 1-based step column: one right of its deepest input. */
  col: number;
  /** Number of ingredient rows this step covers. */
  rowSpan: number;
  colSpan: number;
  /** Equal to `col`; deeper merges sit further right. */
  depth: number;
  /** True for the final step (the finished dish). */
  isRoot: boolean;
  /** Ids of the ingredient rows this step covers, top to bottom. */
  ingredientIds: string[];
  step: Step;
}

export type GridCell = IngredientCell | StepCell;

export interface Grid {
  /** Total columns: 1 ingredient column + step columns. */
  columns: number;
  /** One entry per ingredient row; each holds the cells that START in that row, left to right. */
  rows: GridCell[][];
  /** Step cells in cooking order (every step after all of its inputs). */
  steps: StepCell[];
  /** Ingredient cells top to bottom. */
  ingredients: IngredientCell[];
  prep: PrepStep[];
}

/**
 * Turn a VALID recipe (see `validateRecipe`) into a table grid.
 *
 * Rows are ingredients in depth-first order from the final step, so every step covers a
 * contiguous block of rows. A step's column is one right of its deepest input; an input from a
 * shallower branch stretches (`colSpan`) to meet the step that uses it.
 */
export function layoutRecipe(recipe: Recipe): Grid {
  const ingredientById = new Map(recipe.ingredients.map((i) => [i.id, i]));
  const stepById = new Map(recipe.steps.map((s) => [s.id, s]));
  const used = new Set(recipe.steps.flatMap((s) => s.inputs));
  const root = recipe.steps.find((s) => !used.has(s.id));
  if (!root) throw new Error("recipe-table: recipe has no final step; run validateRecipe() first.");

  const ingredients: IngredientCell[] = [];
  const steps: StepCell[] = [];
  const colOf = new Map<string, number>();

  const place = (id: string): { start: number; end: number; col: number } => {
    const ingredient = ingredientById.get(id);
    if (ingredient) {
      const row = ingredients.length;
      ingredients.push({ kind: "ingredient", id, row, col: 0, rowSpan: 1, colSpan: 1, ingredient });
      colOf.set(id, 0);
      return { start: row, end: row + 1, col: 0 };
    }
    const step = stepById.get(id);
    if (!step) throw new Error(`recipe-table: unknown id "${id}"; run validateRecipe() first.`);
    const parts = step.inputs.map(place);
    const start = Math.min(...parts.map((p) => p.start));
    const end = Math.max(...parts.map((p) => p.end));
    const col = 1 + Math.max(...parts.map((p) => p.col));
    colOf.set(id, col);
    steps.push({
      kind: "step",
      id,
      row: start,
      col,
      rowSpan: end - start,
      colSpan: 1,
      depth: col,
      isRoot: step === root,
      ingredientIds: ingredients.slice(start, end).map((c) => c.id),
      step,
    });
    return { start, end, col };
  };
  place(root.id);

  // Each input stretches to the column of the step that uses it.
  for (const cell of steps) {
    for (const input of cell.step.inputs) {
      const target = ingredients.find((c) => c.id === input) ?? steps.find((c) => c.id === input);
      if (target) target.colSpan = cell.col - (colOf.get(input) ?? 0);
    }
  }

  const rows: GridCell[][] = ingredients.map(() => []);
  for (const cell of [...ingredients, ...steps]) rows[cell.row]!.push(cell);
  for (const row of rows) row.sort((a, b) => a.col - b.col);

  return { columns: 1 + (colOf.get(root.id) ?? 0), rows, steps, ingredients, prep: recipe.prep ?? [] };
}
