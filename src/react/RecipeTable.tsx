import { useEffect, useId, useRef, type CSSProperties, type ReactNode } from "react";
import type { ValidationError } from "../core/validate";
import { DEFAULT_LABELS, partClass, recipeText, safeHref, type RecipeTableLabels, type RecipeTablePart } from "../core/view";
import type { Recipe } from "../core/types";
import { useRecipeTable } from "./useRecipeTable";

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

  const cls = (part: RecipeTablePart, ...extra: (string | false | undefined)[]) => partClass(part, classNames, ...extra);

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
  const text = recipeText(r, grid, labels, { locale, unitLabels: labels.units });
  const Heading = `h${headingLevel}` as "h2";
  const titleId = `${uid}-title`;
  const rowId = (id: string) => `${uid}-ing-${id}`;
  const href = safeHref(r.source?.url);

  return (
    <section className={cls("root", className)} style={style} data-view={view} aria-labelledby={titleId}>
      <header className={cls("header")}>
        <Heading className={cls("title")} id={titleId}>
          {r.title}
        </Heading>
        {text.meta && <p className={cls("meta")}>{text.meta}</p>}
        {r.description && <p className={cls("description")}>{r.description}</p>}
      </header>

      {grid.prep.length > 0 && (
        <ul className={cls("prep")} aria-label={labels.prep}>
          {grid.prep.map((p) => {
            const details = text.stepDetails(p);
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
                        {ing.quantity && <span className={cls("quantity")}>{text.quantity(ing.quantity)}</span>}{" "}
                        <span className={cls("name")}>{ing.name}</span>
                        {ing.note && <>, <span className={cls("note")}>{ing.note}</span></>}
                        {ing.optional && <> <span className={cls("note")}>({labels.optional})</span></>}
                      </th>
                    );
                  }
                  const details = text.stepDetails(cell.step);
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
          const details = text.stepDetails(s.step);
          return (
            <li key={s.id}>
              <span className={cls("action")}>{s.step.action}</span>
              {details && <> <span className={cls("stepMeta")}>{details}</span></>}
              {": "}
              {text.stepInputs(s.step)}
              {s.step.note && <> <span className={cls("note")}>{s.step.note}</span></>}
            </li>
          );
        })}
      </ol>

      {r.source && (r.source.name || r.source.url || r.source.author) && (
        <p className={cls("source")}>
          {labels.source}:{" "}
          {href ? (
            <a href={href} rel="noopener noreferrer">
              {r.source.name ?? r.source.url}
            </a>
          ) : (
            (r.source.name ?? r.source.url)
          )}
          {r.source.author && ` ${labels.by} ${r.source.author}`}
        </p>
      )}
    </section>
  );
}
