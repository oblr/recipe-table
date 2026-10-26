import { formatDuration, formatQuantity, formatTemperature, scaleRecipe, type FormatOptions, type UnitLabels } from "./format";
import { layoutRecipe, type Grid } from "./layout";
import type { PrepStep, Quantity, Recipe, Step } from "./types";
import { validateRecipe, type ValidationError } from "./validate";

/*
 * Rendering logic shared by the React component and the <recipe-table> element: everything about
 * what the markup says, nothing about how it is built.
 */

/** Every styleable element. Each renders with the class `rt-<part>` (camelCase becomes kebab-case). */
export type RecipeTablePart =
  | "root"
  | "header"
  | "title"
  | "meta"
  | "description"
  | "prep"
  | "scroll"
  | "table"
  | "row"
  | "ingredient"
  | "quantity"
  | "name"
  | "note"
  | "step"
  | "action"
  | "stepMeta"
  | "list"
  | "source"
  | "error";

/** UI strings. Recipe text itself is never translated. */
export interface RecipeTableLabels {
  /** Heading of the step list (narrow screens and screen readers). Default "Steps". */
  steps: string;
  /** Accessible name of the prep list. Default "Before you start". */
  prep: string;
  /** Default "Source". */
  source: string;
  /** Default "by". */
  by: string;
  /** Default "optional". */
  optional: string;
  /** Default "Total time". */
  totalTime: string;
  /** How the step list refers to an earlier step's result. Default (n) => `result of step ${n}`. */
  stepResult: (stepNumber: number) => string;
  /** Default "This recipe cannot be shown". */
  errorTitle: string;
  /** Unit display names, e.g. { cup: ["Tasse", "Tassen"] }. */
  units?: UnitLabels;
}

export const DEFAULT_LABELS: RecipeTableLabels = {
  steps: "Steps",
  prep: "Before you start",
  source: "Source",
  by: "by",
  optional: "optional",
  totalTime: "Total time",
  stepResult: (n) => `result of step ${n}`,
  errorTitle: "This recipe cannot be shown",
};

export type PreparedRecipe =
  | { ok: true; recipe: Recipe; grid: Grid; errors: [] }
  | { ok: false; errors: ValidationError[] };

/** Validate, scale and lay out a recipe: the data behind one rendered table. */
export function prepareRecipe(recipe: Recipe | unknown, scale = 1): PreparedRecipe {
  const result = validateRecipe(recipe);
  if (!result.ok) return result;
  const scaled = scaleRecipe(result.recipe, scale);
  return { ok: true, recipe: scaled, grid: layoutRecipe(scaled), errors: [] };
}

const kebab = (s: string) => s.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`);

/** Class list of a part: `rt-<part>`, any modifiers, then the caller's extra class for that part. */
export function partClass(
  part: RecipeTablePart,
  classNames: Partial<Record<RecipeTablePart, string>> | undefined,
  ...extra: (string | false | undefined)[]
): string {
  return [`rt-${kebab(part)}`, ...extra, classNames?.[part]].filter(Boolean).join(" ");
}

/**
 * The url if it is safe to link (http, https or relative), otherwise undefined. Uses the URL parser
 * rather than a pattern, so it sees the scheme the browser sees: the parser drops tabs, newlines and
 * leading control characters, which turns "java\nscript:" into "javascript:".
 */
export function safeHref(url: string | undefined): string | undefined {
  if (!url) return undefined;
  try {
    const { protocol } = new URL(url, "https://relative.invalid/");
    return protocol === "http:" || protocol === "https:" ? url : undefined;
  } catch {
    return undefined;
  }
}

export interface RecipeText {
  /** "4 servings · Total time 30 min", or "" when the recipe has neither. */
  meta: string;
  quantity: (q: Quantity) => string;
  /** "10 min · 180 °C", or "". */
  stepDetails: (step: Step | PrepStep) => string;
  /** A step's inputs for the step list: "2 eggs, result of step 1". */
  stepInputs: (step: Step) => string;
}

/** The display strings of a prepared (valid, scaled) recipe. */
export function recipeText(recipe: Recipe, grid: Grid, labels: RecipeTableLabels, fmt: FormatOptions): RecipeText {
  const quantity = (q: Quantity) => formatQuantity(q, fmt);
  const stepNumber = new Map(grid.steps.map((s, i) => [s.id, i + 1]));
  const ingredientById = new Map(recipe.ingredients.map((i) => [i.id, i]));

  const meta: string[] = [];
  if (recipe.yield) meta.push(`${formatQuantity({ value: recipe.yield.amount }, fmt)} ${recipe.yield.unit}`);
  if (recipe.time?.total) meta.push(`${labels.totalTime} ${formatDuration(recipe.time.total)}`);

  const inputText = (id: string) => {
    const ing = ingredientById.get(id);
    if (!ing) return labels.stepResult(stepNumber.get(id) ?? 0);
    return `${ing.quantity ? `${quantity(ing.quantity)} ` : ""}${ing.name}`;
  };

  return {
    meta: meta.join(" · "),
    quantity,
    stepDetails: (s) =>
      [("duration" in s && s.duration && formatDuration(s.duration)) || "", s.temperature ? formatTemperature(s.temperature) : ""]
        .filter(Boolean)
        .join(" · "),
    stepInputs: (s) => s.inputs.map(inputText).join(", "),
  };
}
