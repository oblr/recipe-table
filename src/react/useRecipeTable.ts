import { useMemo } from "react";
import { prepareRecipe, type PreparedRecipe } from "../core/view";
import type { Recipe } from "../core/types";

export interface UseRecipeTableOptions {
  /** Multiply quantities and yield. Default 1. */
  scale?: number;
}

export type UseRecipeTableResult = PreparedRecipe;

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
  return useMemo(() => prepareRecipe(recipe, scale), [recipe, scale]);
}
