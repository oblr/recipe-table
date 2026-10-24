/**
 * Recipe data types. These mirror `recipe.schema.json`; keep both in sync
 * (a test checks every example against the schema and these rules).
 */

/** Canonical unit codes. Anything else goes into the ingredient `name` or `note` with unit `"piece"`. */
export const UNITS = [
  "g",
  "kg",
  "mg",
  "ml",
  "l",
  "tsp",
  "tbsp",
  "cup",
  "fl-oz",
  "oz",
  "lb",
  "cm",
  "inch",
  "piece",
  "clove",
  "slice",
  "pinch",
  "dash",
  "can",
  "bunch",
  "sprig",
  "stalk",
] as const;

export type Unit = (typeof UNITS)[number];

/**
 * An amount of an ingredient.
 * @example { "value": 0.5, "unit": "cup", "alt": [{ "value": 115, "unit": "g" }] }
 * @example { "value": [2, 3], "unit": "piece" }
 */
export interface Quantity {
  /** A number, or a `[min, max]` range. Fractions as decimals: 0.5, 0.25, 1.5. */
  value: number | [number, number];
  /** Canonical unit code. Omit for bare counts ("2 eggs"). */
  unit?: Unit;
  /** The same amount in another unit, only when the source gives it (never computed). */
  alt?: Omit<Quantity, "alt" | "scalable">[];
  /** Default true. Set false for amounts that must not scale ("1 pinch", "to taste"). */
  scalable?: boolean;
}

/**
 * One ingredient: a row in the table.
 * @example { "id": "butter", "name": "butter", "quantity": { "value": 115, "unit": "g" }, "note": "softened" }
 */
export interface Ingredient {
  /** Unique across ingredients AND steps. Lowercase kebab-case recommended: "brown-sugar". */
  id: string;
  /** Display name, in the recipe's language: "brown sugar". */
  name: string;
  /** Omit for "to taste" items. */
  quantity?: Quantity;
  /** Preparation note shown after the name: "softened", "finely chopped". */
  note?: string;
  /** Marks the ingredient as optional. */
  optional?: boolean;
}

/** A temperature as given by the source. */
export interface Temperature {
  value: number;
  unit: "C" | "F";
}

/**
 * One step: a cell that spans the rows of everything it combines.
 * Each ingredient and each step (except the last, the root) is used by exactly one step.
 * @example { "id": "cream", "action": "cream", "inputs": ["butter", "sugar"], "duration": "PT5M" }
 */
export interface Step {
  /** Unique across ingredients AND steps. */
  id: string;
  /** Short verb phrase in the source's own words: "cream", "fold in", "bake". */
  action: string;
  /** Ids of the ingredients and/or earlier steps this step combines, top to bottom. At least one. */
  inputs: string[];
  /** ISO 8601 duration: "PT5M", "PT1H15M". */
  duration?: string;
  temperature?: Temperature;
  /** Extra detail shown under the action: "until golden". */
  note?: string;
}

/** A step that uses no ingredients ("Preheat oven to 180 °C"). Rendered as a full-width row above the table. */
export interface PrepStep {
  id: string;
  action: string;
  temperature?: Temperature;
  note?: string;
}

/**
 * A recipe in recipe-table format, schema version 1.
 * Validate with `validateRecipe()` before rendering untrusted or generated data.
 */
export interface Recipe {
  schemaVersion: 1;
  title: string;
  description?: string;
  /** @example { "amount": 4, "unit": "servings" } */
  yield?: { amount: number; unit: string };
  /** ISO 8601 durations. */
  time?: { prep?: string; cook?: string; total?: string };
  /** Credit the source whenever the recipe comes from one. */
  source?: { name?: string; url?: string; author?: string };
  prep?: PrepStep[];
  ingredients: Ingredient[];
  steps: Step[];
}
