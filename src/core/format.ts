import type { Quantity, Recipe, Temperature, Unit } from "./types";

/** Display labels per unit: [singular, plural]. Empty string = no label ("2 eggs"). */
export type UnitLabels = Partial<Record<Unit, [string, string]>>;

export const DEFAULT_UNIT_LABELS: Record<Unit, [string, string]> = {
  g: ["g", "g"],
  kg: ["kg", "kg"],
  mg: ["mg", "mg"],
  ml: ["ml", "ml"],
  l: ["l", "l"],
  tsp: ["tsp", "tsp"],
  tbsp: ["tbsp", "tbsp"],
  cup: ["cup", "cups"],
  "fl-oz": ["fl oz", "fl oz"],
  oz: ["oz", "oz"],
  lb: ["lb", "lb"],
  cm: ["cm", "cm"],
  inch: ["inch", "inches"],
  piece: ["", ""],
  clove: ["clove", "cloves"],
  slice: ["slice", "slices"],
  pinch: ["pinch", "pinches"],
  dash: ["dash", "dashes"],
  can: ["can", "cans"],
  bunch: ["bunch", "bunches"],
  sprig: ["sprig", "sprigs"],
  stalk: ["stalk", "stalks"],
};

const METRIC = new Set<Unit>(["g", "kg", "mg", "ml", "l", "cm"]);

const FRACTIONS: [number, string][] = [
  [1 / 8, "⅛"],
  [1 / 4, "¼"],
  [1 / 3, "⅓"],
  [3 / 8, "⅜"],
  [1 / 2, "½"],
  [5 / 8, "⅝"],
  [2 / 3, "⅔"],
  [3 / 4, "¾"],
  [7 / 8, "⅞"],
];

export interface FormatOptions {
  /** BCP 47 locale for decimals, e.g. "de-DE". Default: the runtime's locale. */
  locale?: string;
  /** Override unit display names. */
  unitLabels?: UnitLabels;
}

/** Format one number the way a cook reads it: "1½" for spoons and cups, "115" or "2.5" for metric. */
export function formatAmount(n: number, unit: Unit | undefined, locale?: string): string {
  const decimal = (digits: number) => new Intl.NumberFormat(locale, { maximumFractionDigits: digits }).format(n);
  if (unit && METRIC.has(unit)) {
    if (n >= 100) return new Intl.NumberFormat(locale, { maximumFractionDigits: 0 }).format(Math.round(n / 5) * 5);
    return decimal(n >= 10 ? 0 : 1);
  }
  const whole = Math.floor(n);
  const rest = n - whole;
  if (rest < 0.02) return String(whole);
  if (rest > 0.98) return String(whole + 1);
  const match = FRACTIONS.find(([v]) => Math.abs(v - rest) < 0.02);
  if (match) return whole === 0 ? match[1] : `${whole}${match[1]}`;
  return decimal(2);
}

function formatSingle(q: Omit<Quantity, "alt" | "scalable">, options: FormatOptions): string {
  const { value, unit } = q;
  const amount = Array.isArray(value)
    ? `${formatAmount(value[0], unit, options.locale)}–${formatAmount(value[1], unit, options.locale)}`
    : formatAmount(value, unit, options.locale);
  if (!unit) return amount;
  const labels = options.unitLabels?.[unit] ?? DEFAULT_UNIT_LABELS[unit];
  const top = Array.isArray(value) ? value[1] : value;
  const label = top > 1 ? labels[1] : labels[0];
  return label ? `${amount} ${label}` : amount;
}

/**
 * Format a quantity, including the source's alternative units.
 * @example formatQuantity({ value: 0.5, unit: "cup", alt: [{ value: 115, unit: "g" }] }) // "½ cup / 115 g"
 */
export function formatQuantity(q: Quantity, options: FormatOptions = {}): string {
  return [q, ...(q.alt ?? [])].map((x) => formatSingle(x, options)).join(" / ");
}

/** "PT1H15M" -> "1 h 15 min". Returns the input unchanged if it cannot be parsed. */
export function formatDuration(iso: string): string {
  const m = /^P(?:(\d+(?:\.\d+)?)D)?(?:T(?:(\d+(?:\.\d+)?)H)?(?:(\d+(?:\.\d+)?)M)?(?:(\d+(?:\.\d+)?)S)?)?$/.exec(iso);
  if (!m) return iso;
  const parts = [
    [m[1], "d"],
    [m[2], "h"],
    [m[3], "min"],
    [m[4], "s"],
  ]
    .filter(([v]) => v !== undefined)
    .map(([v, u]) => `${v} ${u}`);
  return parts.join(" ") || iso;
}

/** { value: 180, unit: "C" } -> "180 °C" */
export function formatTemperature(t: Temperature): string {
  return `${t.value} °${t.unit}`;
}

/**
 * Multiply every scalable quantity (and the yield) by `factor`. Durations and temperatures are
 * never scaled. Returns a new recipe; the input is not modified.
 * @example scaleRecipe(recipe, 2) // double the batch
 */
export function scaleRecipe(recipe: Recipe, factor: number): Recipe {
  if (factor === 1) return recipe;
  const mul = (v: number | [number, number]): number | [number, number] =>
    Array.isArray(v) ? [v[0] * factor, v[1] * factor] : v * factor;
  return {
    ...recipe,
    ...(recipe.yield && { yield: { ...recipe.yield, amount: recipe.yield.amount * factor } }),
    ingredients: recipe.ingredients.map((ing) => {
      const q = ing.quantity;
      if (!q || q.scalable === false) return ing;
      return {
        ...ing,
        quantity: { ...q, value: mul(q.value), alt: q.alt?.map((a) => ({ ...a, value: mul(a.value) })) },
      };
    }),
  };
}
