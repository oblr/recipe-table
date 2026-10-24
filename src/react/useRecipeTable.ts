import { useMemo } from "react";
import { scaleRecipe } from "../core/format";
import { layoutRecipe, type Grid } from "../core/layout";
import type { Recipe } from "../core/types";
import { validateRecipe, type ValidationError } from "../core/validate";

export interface UseRecipeTableOptions {
  /** Multiply quantities and yield. Default 1. */
  scale?: number;
}

export type UseRecipeTableResult =
  | { ok: true; recipe: Recipe; grid: Grid; errors: [] }
  | { ok: false; errors: ValidationError[] };

/**
 * Headless version of `<RecipeTable>`: validates, scales and lays out the recipe, and leaves the
 * markup to you. Memoised on `recipe` and `scale`.
 *
 * @example
 * const table = useRecipeTable(recipe, { scale: 2 });
 * if (!table.ok) return <pre>{JSON.stringify(table.errors, null, 2)}</pre>;
 * table.grid.rows.map(...)
 */
export function useRecipeTable(recipe: Recipe | unknown, options: UseRecipeTableOptions = {}): UseRecipeTableResult {
  const scale = options.scale ?? 1;
  return useMemo(() => {
    const result = validateRecipe(recipe);
    if (!result.ok) return result;
    const scaled = scaleRecipe(result.recipe, scale);
    return { ok: true, recipe: scaled, grid: layoutRecipe(scaled), errors: [] };
  }, [recipe, scale]);
}
