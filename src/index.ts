/**
 * recipe-table: render recipes as tabular recipes in React.
 *
 * @example
 * import { RecipeTable } from "recipe-table";
 * import "recipe-table/styles.css";
 * <RecipeTable recipe={recipe} />
 */
export * from "./core";
export { RecipeTable, type RecipeTableProps } from "./react/RecipeTable";
export { useRecipeTable, type UseRecipeTableOptions, type UseRecipeTableResult } from "./react/useRecipeTable";
