import { useEffect, useId, useRef, type CSSProperties, type ReactNode } from "react";
import { formatDuration, formatQuantity, formatTemperature, type FormatOptions, type UnitLabels } from "../core/format";
import type { StepCell } from "../core/layout";
import type { Recipe } from "../core/types";
import type { ValidationError } from "../core/validate";
import { useRecipeTable } from "./useRecipeTable";

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

const DEFAULT_LABELS: RecipeTableLabels = {
  steps: "Steps",
  prep: "Before you start",
  source: "Source",
  by: "by",
  optional: "optional",
  totalTime: "Total time",
  stepResult: (n) => `result of step ${n}`,
  errorTitle: "This recipe cannot be shown",
};

export interface RecipeTableProps {
  /** The recipe to render. Validated on every change; invalid data renders an error block, never a wrong table. */
  recipe: Recipe;
  /** Multiply quantities and yield. Durations and temperatures never scale. Default 1. */
  scale?: number;
  /**
   * "table": always the grid. "list": always the numbered step list.
   * "auto" (default): the grid, switching to the list when the component is narrower than 36rem
   * (a CSS container query in styles.css).
   */
  view?: "auto" | "table" | "list";
  /** BCP 47 locale for numbers. Default: the runtime's locale. */
  locale?: string;
  /** Override any UI string. */
  labels?: Partial<RecipeTableLabels>;
  /** Heading level of the recipe title. Default 2. */
  headingLevel?: 2 | 3 | 4 | 5 | 6;
  /** Extra class on the root element. */
  className?: string;
  /** Extra classes per part, e.g. for Tailwind: { step: "bg-amber-100" }. */
  classNames?: Partial<Record<RecipeTablePart, string>>;
  /** Inline style on the root, handy for tokens: { "--rt-color-accent": "teal" }. */
  style?: CSSProperties & Record<`--rt-${string}`, string | number>;
  /** Called with the validation errors whenever `recipe` is invalid. */
  onError?: (errors: ValidationError[]) => void;
}

const kebab = (s: string) => s.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`);

/**
 * Render a recipe as a tabular recipe: ingredients are rows, steps are columns, and each step
 * spans the ingredients it combines.
 *
 * @example
 * import { RecipeTable } from "recipe-table";
 * import "recipe-table/styles.css";
 *
 * <RecipeTable recipe={pancakes} scale={2} />
 */
export function RecipeTable(props: RecipeTableProps): ReactNode {
  const { recipe, scale = 1, view = "auto", locale, headingLevel = 2, className, classNames, style, onError } = props;
  const labels = { ...DEFAULT_LABELS, ...props.labels };
  const table = useRecipeTable(recipe, { scale });
  const uid = useId();

  const cls = (part: RecipeTablePart, ...extra: (string | false | undefined)[]) =>
    [`rt-${kebab(part)}`, ...extra, classNames?.[part]].filter(Boolean).join(" ");

  // Report each new set of errors once, even if the caller passes a fresh onError every render.
  const onErrorRef = useRef(onError);
  onErrorRef.current = onError;
  const errors = table.ok ? null : table.errors;
  useEffect(() => {
    if (errors) onErrorRef.current?.(errors);
  }, [errors]);

  if (!table.ok) {
    return (
      <div className={cls("root", "rt-error", className)} style={style} role="alert" data-view={view}>
        <p className={cls("error")}>{labels.errorTitle}</p>
        <ul>
          {table.errors.map((e, i) => (
            <li key={i}>
              <code>{e.path || "/"}</code> {e.message}
              {e.hint ? ` ${e.hint}` : ""}
            </li>
          ))}
        </ul>
      </div>
    );
  }

  const { grid, recipe: r } = table;
  const fmt: FormatOptions = { locale, unitLabels: labels.units };
  const Heading = `h${headingLevel}` as "h2";
  const titleId = `${uid}-title`;
  const rowId = (id: string) => `${uid}-ing-${id}`;
  const stepNumber = new Map(grid.steps.map((s, i) => [s.id, i + 1]));

  const meta: string[] = [];
  if (r.yield) meta.push(`${formatQuantity({ value: r.yield.amount }, fmt)} ${r.yield.unit}`);
  if (r.time?.total) meta.push(`${labels.totalTime} ${formatDuration(r.time.total)}`);

  const stepDetails = (s: StepCell["step"] | NonNullable<Recipe["prep"]>[number]) =>
    [("duration" in s && s.duration && formatDuration(s.duration)) || "", s.temperature ? formatTemperature(s.temperature) : ""]
      .filter(Boolean)
      .join(" · ");

  const ingredientById = new Map(r.ingredients.map((i) => [i.id, i]));
  const inputText = (id: string) => {
    const ing = ingredientById.get(id);
    if (!ing) return labels.stepResult(stepNumber.get(id) ?? 0);
    return `${ing.quantity ? `${formatQuantity(ing.quantity, fmt)} ` : ""}${ing.name}`;
  };

  return (
    <section className={cls("root", className)} style={style} data-view={view} aria-labelledby={titleId}>
      <header className={cls("header")}>
        <Heading className={cls("title")} id={titleId}>
          {r.title}
        </Heading>
        {meta.length > 0 && <p className={cls("meta")}>{meta.join(" · ")}</p>}
        {r.description && <p className={cls("description")}>{r.description}</p>}
      </header>

      {grid.prep.length > 0 && (
        <ul className={cls("prep")} aria-label={labels.prep}>
          {grid.prep.map((p) => {
            const details = stepDetails(p);
            return (
              <li key={p.id}>
                <span className={cls("action")}>{p.action}</span>
                {details && <> <span className={cls("stepMeta")}>{details}</span></>}
                {p.note && <> <span className={cls("note")}>{p.note}</span></>}
              </li>
            );
          })}
        </ul>
      )}

      <div className={cls("scroll")}>
        <table className={cls("table")} aria-labelledby={titleId}>
          <tbody>
            {grid.rows.map((row, i) => (
              <tr key={i} className={cls("row")}>
                {row.map((cell) => {
                  if (cell.kind === "ingredient") {
                    const ing = cell.ingredient;
                    return (
                      <th
                        key={cell.id}
                        id={rowId(cell.id)}
                        scope="row"
                        colSpan={cell.colSpan > 1 ? cell.colSpan : undefined}
                        className={cls("ingredient")}
                        data-optional={ing.optional || undefined}
                      >
                        {ing.quantity && <span className={cls("quantity")}>{formatQuantity(ing.quantity, fmt)}</span>}{" "}
                        <span className={cls("name")}>{ing.name}</span>
                        {ing.note && <>, <span className={cls("note")}>{ing.note}</span></>}
                        {ing.optional && <> <span className={cls("note")}>({labels.optional})</span></>}
                      </th>
                    );
                  }
                  const details = stepDetails(cell.step);
                  return (
                    <td
                      key={cell.id}
                      rowSpan={cell.rowSpan > 1 ? cell.rowSpan : undefined}
                      colSpan={cell.colSpan > 1 ? cell.colSpan : undefined}
                      headers={cell.ingredientIds.map(rowId).join(" ")}
                      className={cls("step", cell.isRoot && "rt-step-root")}
                      data-depth={cell.depth}
                      data-root={cell.isRoot || undefined}
                    >
                      <span className={cls("action")}>{cell.step.action}</span>
                      {details && <> <span className={cls("stepMeta")}>{details}</span></>}
                      {cell.step.note && <> <span className={cls("note")}>{cell.step.note}</span></>}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ol className={cls("list")} aria-label={labels.steps}>
        {grid.steps.map((s) => {
          const details = stepDetails(s.step);
          return (
            <li key={s.id}>
              <span className={cls("action")}>{s.step.action}</span>
              {details && <> <span className={cls("stepMeta")}>{details}</span></>}
              {": "}
              {s.step.inputs.map(inputText).join(", ")}
              {s.step.note && <> <span className={cls("note")}>{s.step.note}</span></>}
            </li>
          );
        })}
      </ol>

      {r.source && (r.source.name || r.source.url || r.source.author) && (
        <p className={cls("source")}>
          {labels.source}:{" "}
          {r.source.url ? (
            <a href={r.source.url} rel="noopener noreferrer">
              {r.source.name ?? r.source.url}
            </a>
          ) : (
            r.source.name
          )}
          {r.source.author && ` ${labels.by} ${r.source.author}`}
        </p>
      )}
    </section>
  );
}
