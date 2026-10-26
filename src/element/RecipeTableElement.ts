import type { Recipe } from "../core/types";
import type { ValidationError } from "../core/validate";
import {
  DEFAULT_LABELS,
  partClass,
  prepareRecipe,
  recipeText,
  safeHref,
  type RecipeTableLabels,
  type RecipeTablePart,
} from "../core/view";

export type RecipeTableView = "auto" | "table" | "list";

/** `detail` of the `recipe-error` event. */
export interface RecipeErrorDetail {
  errors: ValidationError[];
}

type Child = Node | string | false | null | undefined;
type Attrs = Record<string, string | number | true | false | undefined>;

// Importing this module on a server (no DOM) must not throw; the element just cannot be defined there.
const Base = (typeof HTMLElement === "undefined" ? class {} : HTMLElement) as typeof HTMLElement;

const VIEWS: RecipeTableView[] = ["auto", "table", "list"];
const PROPERTIES = ["recipe", "labels", "classNames", "scale", "view", "locale", "headingLevel"] as const;
let instances = 0;

/**
 * `<recipe-table>`: the same markup as the React `<RecipeTable>`, without React. Renders into the
 * light DOM, so styles.css, `--rt-*` tokens, `data-theme` and your own CSS apply unchanged.
 *
 * Attributes: `scale`, `view`, `locale`, `heading-level`. Properties: the same plus `recipe`,
 * `labels` and `classNames`. Fires `recipe-error` (detail: `{ errors }`) when the recipe is invalid.
 *
 * @example
 * import { defineRecipeTable } from "recipe-table/element";
 * import "recipe-table/styles.css";
 * defineRecipeTable();
 * document.querySelector("recipe-table").recipe = pancakes;
 */
export class RecipeTableElement extends Base {
  static observedAttributes = ["scale", "view", "locale", "heading-level"];

  #recipe: Recipe | undefined;
  #labels: Partial<RecipeTableLabels> | undefined;
  #classNames: Partial<Record<RecipeTablePart, string>> | undefined;
  #uid = `rt${++instances}`;
  #reported: { recipe: unknown; scale: number } | undefined;

  /** The recipe to render. Validated on every change; invalid data renders an error block. */
  get recipe(): Recipe | undefined {
    return this.#recipe;
  }
  set recipe(value: Recipe | undefined) {
    this.#recipe = value;
    this.#update();
  }

  /** Override any UI string. */
  get labels(): Partial<RecipeTableLabels> | undefined {
    return this.#labels;
  }
  set labels(value: Partial<RecipeTableLabels> | undefined) {
    this.#labels = value;
    this.#update();
  }

  /** Extra classes per part, e.g. for Tailwind: { step: "bg-amber-100" }. */
  get classNames(): Partial<Record<RecipeTablePart, string>> | undefined {
    return this.#classNames;
  }
  set classNames(value: Partial<Record<RecipeTablePart, string>> | undefined) {
    this.#classNames = value;
    this.#update();
  }

  /** Multiply quantities and yield. Reflects the `scale` attribute; anything but a number > 0 means 1. */
  get scale(): number {
    const n = Number(this.getAttribute("scale") ?? 1);
    return n > 0 ? n : 1;
  }
  set scale(value: number) {
    this.setAttribute("scale", String(value));
  }

  /** "auto" (default), "table" or "list". Reflects the `view` attribute. */
  get view(): RecipeTableView {
    const v = this.getAttribute("view") as RecipeTableView;
    return VIEWS.includes(v) ? v : "auto";
  }
  set view(value: RecipeTableView) {
    this.setAttribute("view", value);
  }

  /** BCP 47 locale for numbers. Reflects the `locale` attribute. Default: the runtime's locale. */
  get locale(): string | undefined {
    return this.getAttribute("locale") ?? undefined;
  }
  set locale(value: string | undefined) {
    if (value === undefined) this.removeAttribute("locale");
    else this.setAttribute("locale", value);
  }

  /** Heading level of the recipe title, 2 to 6. Reflects `heading-level`. Default 2. */
  get headingLevel(): 2 | 3 | 4 | 5 | 6 {
    const n = Number(this.getAttribute("heading-level"));
    return n >= 2 && n <= 6 && Number.isInteger(n) ? (n as 2) : 2;
  }
  set headingLevel(value: 2 | 3 | 4 | 5 | 6) {
    this.setAttribute("heading-level", String(value));
  }

  connectedCallback(): void {
    // A property set before the element was defined shadows the setter; move it onto the setter.
    for (const name of PROPERTIES) {
      if (Object.prototype.hasOwnProperty.call(this, name)) {
        const value = (this as Record<string, unknown>)[name];
        delete (this as Record<string, unknown>)[name];
        (this as Record<string, unknown>)[name] = value;
      }
    }
    this.#update();
  }

  attributeChangedCallback(): void {
    this.#update();
  }

  #update(): void {
    if (!this.isConnected) return;
    if (this.#recipe === undefined) {
      this.replaceChildren();
      return;
    }
    const { scale } = this;
    const table = prepareRecipe(this.#recipe, scale);
    this.replaceChildren(table.ok ? this.#table(table) : this.#errors(table.errors));
    // Report each new set of errors once, like onError in React: only when recipe or scale changed.
    if (!table.ok && (this.#reported?.recipe !== this.#recipe || this.#reported.scale !== scale)) {
      this.#reported = { recipe: this.#recipe, scale };
      this.dispatchEvent(new CustomEvent<RecipeErrorDetail>("recipe-error", { detail: { errors: table.errors }, bubbles: true }));
    } else if (table.ok) {
      this.#reported = undefined;
    }
  }

  #h(tag: string, attrs: Attrs, ...children: Child[]): HTMLElement {
    const el = this.ownerDocument.createElement(tag);
    for (const [name, value] of Object.entries(attrs)) {
      if (value !== undefined && value !== false) el.setAttribute(name, String(value));
    }
    el.append(...children.filter((c): c is Node | string => c !== false && c !== null && c !== undefined && c !== ""));
    return el;
  }

  #cls(part: RecipeTablePart, ...extra: (string | false | undefined)[]): string {
    return partClass(part, this.#classNames, ...extra);
  }

  #labelsWithDefaults(): RecipeTableLabels {
    return { ...DEFAULT_LABELS, ...this.#labels };
  }

  #errors(errors: ValidationError[]): HTMLElement {
    const h = this.#h.bind(this);
    return h(
      "div",
      { class: this.#cls("root", "rt-error"), role: "alert", "data-view": this.view },
      h("p", { class: this.#cls("error") }, this.#labelsWithDefaults().errorTitle),
      h("ul", {}, ...errors.map((e) => h("li", {}, h("code", {}, e.path || "/"), " ", e.message, e.hint ? ` ${e.hint}` : ""))),
    );
  }

  #table(table: Extract<ReturnType<typeof prepareRecipe>, { ok: true }>): HTMLElement {
    const h = this.#h.bind(this);
    const cls = this.#cls.bind(this);
    const { grid, recipe: r } = table;
    const labels = this.#labelsWithDefaults();
    const text = recipeText(r, grid, labels, { locale: this.locale, unitLabels: labels.units });
    const titleId = `${this.#uid}-title`;
    const rowId = (id: string) => `${this.#uid}-ing-${id}`;
    const href = safeHref(r.source?.url);
    const span = (part: RecipeTablePart, content: string) => h("span", { class: cls(part) }, content);
    // " <stepMeta>" and " <note>" after an action, when present.
    const after = (details: string, note: string | undefined): Child[] => [
      details && " ",
      details && span("stepMeta", details),
      note && " ",
      note && span("note", note),
    ];

    const rows = grid.rows.map((row) =>
      h(
        "tr",
        { class: cls("row") },
        ...row.map((cell) => {
          if (cell.kind === "ingredient") {
            const ing = cell.ingredient;
            return h(
              "th",
              {
                id: rowId(cell.id),
                scope: "row",
                colspan: cell.colSpan > 1 ? cell.colSpan : undefined,
                class: cls("ingredient"),
                "data-optional": ing.optional || undefined,
              },
              ing.quantity && span("quantity", text.quantity(ing.quantity)),
              " ",
              span("name", ing.name),
              ing.note && ", ",
              ing.note && span("note", ing.note),
              ing.optional && " ",
              ing.optional && span("note", `(${labels.optional})`),
            );
          }
          return h(
            "td",
            {
              rowspan: cell.rowSpan > 1 ? cell.rowSpan : undefined,
              colspan: cell.colSpan > 1 ? cell.colSpan : undefined,
              headers: cell.ingredientIds.map(rowId).join(" "),
              class: cls("step", cell.isRoot && "rt-step-root"),
              "data-depth": cell.depth,
              "data-root": cell.isRoot || undefined,
            },
            span("action", cell.step.action),
            ...after(text.stepDetails(cell.step), cell.step.note),
          );
        }),
      ),
    );

    return h(
      "section",
      { class: cls("root"), "data-view": this.view, "aria-labelledby": titleId },
      h(
        "header",
        { class: cls("header") },
        h(`h${this.headingLevel}`, { class: cls("title"), id: titleId }, r.title),
        text.meta && h("p", { class: cls("meta") }, text.meta),
        r.description && h("p", { class: cls("description") }, r.description),
      ),
      grid.prep.length > 0 &&
        h(
          "ul",
          { class: cls("prep"), "aria-label": labels.prep },
          ...grid.prep.map((p) => h("li", {}, span("action", p.action), ...after(text.stepDetails(p), p.note))),
        ),
      h("div", { class: cls("scroll") }, h("table", { class: cls("table"), "aria-labelledby": titleId }, h("tbody", {}, ...rows))),
      h(
        "ol",
        { class: cls("list"), "aria-label": labels.steps },
        ...grid.steps.map((s) => {
          const details = text.stepDetails(s.step);
          return h(
            "li",
            {},
            span("action", s.step.action),
            details && " ",
            details && span("stepMeta", details),
            ": ",
            text.stepInputs(s.step),
            s.step.note && " ",
            s.step.note && span("note", s.step.note),
          );
        }),
      ),
      r.source &&
        (r.source.name || r.source.url || r.source.author) &&
        h(
          "p",
          { class: cls("source") },
          `${labels.source}: `,
          href ? h("a", { href, rel: "noopener noreferrer" }, r.source.name ?? href) : (r.source.name ?? r.source.url),
          r.source.author && ` ${labels.by} ${r.source.author}`,
        ),
    );
  }
}

/**
 * Register `<recipe-table>` (or another tag name). Safe to call more than once. Does nothing
 * outside the browser.
 */
export function defineRecipeTable(tagName = "recipe-table"): void {
  if (typeof customElements === "undefined" || customElements.get(tagName)) return;
  customElements.define(tagName, tagName === "recipe-table" ? RecipeTableElement : class extends RecipeTableElement {});
}

declare global {
  interface HTMLElementTagNameMap {
    "recipe-table": RecipeTableElement;
  }
  interface HTMLElementEventMap {
    "recipe-error": CustomEvent<RecipeErrorDetail>;
  }
}
