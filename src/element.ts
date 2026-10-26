/**
 * recipe-table/element: the `<recipe-table>` custom element, for pages without React.
 * Validation, layout and formatting helpers are in recipe-table/core.
 *
 * @example
 * import { defineRecipeTable } from "recipe-table/element";
 * import "recipe-table/styles.css";
 * defineRecipeTable();
 */
export {
  RecipeTableElement,
  defineRecipeTable,
  type RecipeErrorDetail,
  type RecipeTableView,
} from "./element/RecipeTableElement";
export type { RecipeTableLabels, RecipeTablePart } from "./core/view";
