import { UNITS, type Recipe } from "./types";

/** Stable error codes. Codes are public API; messages may change. */
export type ValidationCode =
  | "invalid_type"
  | "missing_field"
  | "unknown_field"
  | "unsupported_schema_version"
  | "invalid_value"
  | "invalid_unit"
  | "invalid_duration"
  | "duplicate_id"
  | "empty_inputs"
  | "unknown_input"
  | "self_input"
  | "input_reused"
  | "ingredient_unused"
  | "multiple_roots"
  | "no_root"
  | "cycle";

export interface ValidationError {
  /** JSON Pointer to the offending value: "/steps/2/inputs/0". */
  path: string;
  code: ValidationCode;
  /** What is wrong, naming the ids involved. */
  message: string;
  /** How to fix it, when there is a usual fix. */
  hint?: string;
}

export type ValidationResult =
  | { ok: true; recipe: Recipe; errors: [] }
  | { ok: false; errors: ValidationError[] };

const ISO_DURATION = /^P(?!$)(\d+(\.\d+)?D)?(T(?=\d)(\d+(\.\d+)?H)?(\d+(\.\d+)?M)?(\d+(\.\d+)?S)?)?$/;

const FIELDS = {
  recipe: ["schemaVersion", "title", "description", "yield", "time", "source", "prep", "ingredients", "steps"],
  ingredient: ["id", "name", "quantity", "note", "optional"],
  quantity: ["value", "unit", "alt", "scalable"],
  alt: ["value", "unit"],
  step: ["id", "action", "inputs", "duration", "temperature", "note"],
  prep: ["id", "action", "temperature", "note"],
  temperature: ["value", "unit"],
  yield: ["amount", "unit"],
  time: ["prep", "cook", "total"],
  source: ["name", "url", "author"],
} as const;

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => typeof v === "object" && v !== null && !Array.isArray(v);
const isNum = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);

/**
 * Check a value against the recipe schema and the merge-tree rules:
 * unique ids, every ingredient and step used exactly once, exactly one final step, no cycles.
 *
 * Never throws. On failure, every error carries a JSON Pointer `path`, a stable `code`,
 * and a message naming the ids involved, so a person or an LLM can fix the data and retry.
 *
 * @example
 * const result = validateRecipe(json);
 * if (!result.ok) console.error(result.errors);
 */
export function validateRecipe(input: unknown): ValidationResult {
  const errors: ValidationError[] = [];
  const err = (path: string, code: ValidationCode, message: string, hint?: string) =>
    errors.push(hint ? { path, code, message, hint } : { path, code, message });

  const checkFields = (obj: Obj, path: string, allowed: readonly string[]) => {
    for (const key of Object.keys(obj)) {
      if (!allowed.includes(key)) {
        err(`${path}/${key}`, "unknown_field", `Unknown field "${key}".`, `Allowed fields here: ${allowed.join(", ")}.`);
      }
    }
  };
  const requireString = (obj: Obj, key: string, path: string) => {
    if (!(key in obj)) err(`${path}/${key}`, "missing_field", `Missing required field "${key}".`);
    else if (typeof obj[key] !== "string" || (obj[key] as string).trim() === "")
      err(`${path}/${key}`, "invalid_type", `"${key}" must be a non-empty string.`);
  };
  const optionalString = (obj: Obj, key: string, path: string) => {
    if (key in obj && typeof obj[key] !== "string") err(`${path}/${key}`, "invalid_type", `"${key}" must be a string.`);
  };
  const optionalDuration = (obj: Obj, key: string, path: string) => {
    if (!(key in obj)) return;
    if (typeof obj[key] !== "string" || !ISO_DURATION.test(obj[key] as string))
      err(`${path}/${key}`, "invalid_duration", `"${key}" must be an ISO 8601 duration.`, `Examples: "PT5M" (5 min), "PT1H15M" (1 h 15 min).`);
  };
  const checkTemperature = (v: unknown, path: string) => {
    if (!isObj(v)) return err(path, "invalid_type", "temperature must be an object { value, unit }.");
    checkFields(v, path, FIELDS.temperature);
    if (!isNum(v.value)) err(`${path}/value`, "invalid_type", "temperature.value must be a number.");
    if (v.unit !== "C" && v.unit !== "F") err(`${path}/unit`, "invalid_unit", `temperature.unit must be "C" or "F".`);
  };
  const checkAmount = (q: Obj, path: string) => {
    const v = q.value;
    const ok =
      (isNum(v) && v >= 0) ||
      (Array.isArray(v) && v.length === 2 && isNum(v[0]) && isNum(v[1]) && v[0] >= 0 && v[0] <= v[1]);
    if (!ok)
      err(`${path}/value`, "invalid_value", "quantity.value must be a number >= 0 or a [min, max] range.", "Write fractions as decimals: 0.5, not \"1/2\".");
    if ("unit" in q && !(UNITS as readonly unknown[]).includes(q.unit))
      err(`${path}/unit`, "invalid_unit", `Unknown unit ${JSON.stringify(q.unit)}.`, `Use one of: ${UNITS.join(", ")}. For anything else use "piece" and describe it in the name.`);
  };

  if (!isObj(input)) {
    err("", "invalid_type", "A recipe must be a JSON object.");
    return { ok: false, errors };
  }
  const r = input;
  checkFields(r, "", FIELDS.recipe);
  if (r.schemaVersion !== 1)
    err("/schemaVersion", "unsupported_schema_version", `schemaVersion must be 1, got ${JSON.stringify(r.schemaVersion)}.`);
  requireString(r, "title", "");
  optionalString(r, "description", "");

  if ("yield" in r) {
    if (!isObj(r.yield)) err("/yield", "invalid_type", "yield must be an object { amount, unit }.");
    else {
      checkFields(r.yield, "/yield", FIELDS.yield);
      if (!isNum(r.yield.amount) || r.yield.amount <= 0) err("/yield/amount", "invalid_value", "yield.amount must be a number > 0.");
      requireString(r.yield, "unit", "/yield");
    }
  }
  if ("time" in r) {
    if (!isObj(r.time)) err("/time", "invalid_type", "time must be an object { prep?, cook?, total? }.");
    else {
      checkFields(r.time, "/time", FIELDS.time);
      for (const k of FIELDS.time) optionalDuration(r.time, k, "/time");
    }
  }
  if ("source" in r) {
    if (!isObj(r.source)) err("/source", "invalid_type", "source must be an object { name?, url?, author? }.");
    else {
      checkFields(r.source, "/source", FIELDS.source);
      for (const k of FIELDS.source) optionalString(r.source, k, "/source");
    }
  }

  // id -> where it was defined, for duplicate detection and input lookup
  const defined = new Map<string, { kind: "ingredient" | "step" | "prep"; path: string }>();
  const define = (id: unknown, kind: "ingredient" | "step" | "prep", path: string) => {
    if (typeof id !== "string" || id === "") return;
    const prev = defined.get(id);
    if (prev) err(`${path}/id`, "duplicate_id", `Id "${id}" is already used at ${prev.path}.`, "Ids must be unique across ingredients, steps and prep steps.");
    else defined.set(id, { kind, path });
  };

  if ("prep" in r) {
    if (!Array.isArray(r.prep)) err("/prep", "invalid_type", "prep must be an array.");
    else
      r.prep.forEach((p, i) => {
        const path = `/prep/${i}`;
        if (!isObj(p)) return err(path, "invalid_type", "A prep step must be an object.");
        checkFields(p, path, FIELDS.prep);
        requireString(p, "id", path);
        requireString(p, "action", path);
        optionalString(p, "note", path);
        if ("temperature" in p) checkTemperature(p.temperature, `${path}/temperature`);
        define(p.id, "prep", path);
      });
  }

  const ingredients = Array.isArray(r.ingredients) ? r.ingredients : [];
  if (!("ingredients" in r)) err("/ingredients", "missing_field", `Missing required field "ingredients".`);
  else if (!Array.isArray(r.ingredients)) err("/ingredients", "invalid_type", "ingredients must be an array.");
  else if (ingredients.length === 0) err("/ingredients", "invalid_value", "A recipe needs at least one ingredient.");
  ingredients.forEach((ing, i) => {
    const path = `/ingredients/${i}`;
    if (!isObj(ing)) return err(path, "invalid_type", "An ingredient must be an object.");
    checkFields(ing, path, FIELDS.ingredient);
    requireString(ing, "id", path);
    requireString(ing, "name", path);
    optionalString(ing, "note", path);
    if ("optional" in ing && typeof ing.optional !== "boolean") err(`${path}/optional`, "invalid_type", "optional must be a boolean.");
    if ("quantity" in ing) {
      const q = ing.quantity;
      const qp = `${path}/quantity`;
      if (!isObj(q)) err(qp, "invalid_type", "quantity must be an object { value, unit? }.");
      else {
        checkFields(q, qp, FIELDS.quantity);
        checkAmount(q, qp);
        if ("scalable" in q && typeof q.scalable !== "boolean") err(`${qp}/scalable`, "invalid_type", "scalable must be a boolean.");
        if ("alt" in q) {
          if (!Array.isArray(q.alt)) err(`${qp}/alt`, "invalid_type", "alt must be an array of { value, unit }.");
          else
            q.alt.forEach((a, j) => {
              if (!isObj(a)) return err(`${qp}/alt/${j}`, "invalid_type", "alt entries must be objects { value, unit }.");
              checkFields(a, `${qp}/alt/${j}`, FIELDS.alt);
              checkAmount(a, `${qp}/alt/${j}`);
            });
        }
      }
    }
    define(ing.id, "ingredient", path);
  });

  const steps = Array.isArray(r.steps) ? r.steps : [];
  if (!("steps" in r)) err("/steps", "missing_field", `Missing required field "steps".`);
  else if (!Array.isArray(r.steps)) err("/steps", "invalid_type", "steps must be an array.");
  else if (steps.length === 0) err("/steps", "invalid_value", "A recipe needs at least one step.");
  steps.forEach((s, i) => {
    const path = `/steps/${i}`;
    if (!isObj(s)) return err(path, "invalid_type", "A step must be an object.");
    checkFields(s, path, FIELDS.step);
    requireString(s, "id", path);
    requireString(s, "action", path);
    optionalString(s, "note", path);
    optionalDuration(s, "duration", path);
    if ("temperature" in s) checkTemperature(s.temperature, `${path}/temperature`);
    if (!("inputs" in s)) err(`${path}/inputs`, "missing_field", `Missing required field "inputs".`);
    else if (!Array.isArray(s.inputs) || s.inputs.some((x) => typeof x !== "string"))
      err(`${path}/inputs`, "invalid_type", "inputs must be an array of id strings.");
    else if (s.inputs.length === 0)
      err(`${path}/inputs`, "empty_inputs", `Step "${String(s.id)}" has no inputs.`, "A step without ingredients belongs in \"prep\".");
    define(s.id, "step", path);
  });

  // Stop before tree checks if the shape is broken; tree errors would only add noise.
  if (errors.length > 0) return { ok: false, errors };

  // Merge-tree rules.
  const recipe = r as unknown as Recipe;
  const consumer = new Map<string, string>(); // input id -> step id that uses it
  const knownIds = [...recipe.ingredients.map((x) => x.id), ...recipe.steps.map((x) => x.id)];
  recipe.steps.forEach((step, i) => {
    step.inputs.forEach((id, j) => {
      const path = `/steps/${i}/inputs/${j}`;
      const def = defined.get(id);
      if (id === step.id) return err(path, "self_input", `Step "${step.id}" lists itself as an input.`);
      if (!def || def.kind === "prep") {
        const why = def ? `"${id}", which is a prep step and cannot be an input` : `"${id}", which does not exist`;
        return err(path, "unknown_input", `Step "${step.id}" uses ${why}.`, `Known ingredient and step ids: ${knownIds.join(", ")}.`);
      }
      const prev = consumer.get(id);
      if (prev !== undefined)
        return err(
          path,
          "input_reused",
          `"${id}" is used by both step "${prev}" and step "${step.id}"; each ingredient and step is used exactly once.`,
          def.kind === "ingredient"
            ? `If the recipe divides it, list it as two ingredients, e.g. "${id}-1" and "${id}-2" with a note "for the ...".`
            : `Chain the steps instead: let "${step.id}" use the output of "${prev}", or the reverse.`,
        );
      consumer.set(id, step.id);
    });
  });
  recipe.ingredients.forEach((ing, i) => {
    if (!consumer.has(ing.id))
      err(`/ingredients/${i}`, "ingredient_unused", `Ingredient "${ing.id}" is not used by any step.`, "Add its id to the inputs of the step that adds it.");
  });
  const roots = recipe.steps.filter((s) => !consumer.has(s.id));
  if (roots.length > 1)
    err(
      "/steps",
      "multiple_roots",
      `Several steps are not used by any later step: ${roots.map((s) => `"${s.id}"`).join(", ")}. Exactly one step (the finished dish) may be last.`,
      "Add a final step that combines them, or add each to the inputs of the step that uses its result.",
    );

  // Cycle detection over step -> input edges.
  const stepById = new Map(recipe.steps.map((s) => [s.id, s]));
  const state = new Map<string, 1 | 2>(); // 1 = on stack, 2 = done
  const visit = (id: string, trail: string[]): boolean => {
    if (state.get(id) === 2) return false;
    if (state.get(id) === 1) {
      const loop = [...trail.slice(trail.indexOf(id)), id];
      const i = recipe.steps.findIndex((s) => s.id === id);
      err(`/steps/${i}`, "cycle", `Steps form a loop: ${loop.join(" -> ")}.`, "A step may only use earlier results.");
      return true;
    }
    state.set(id, 1);
    for (const input of stepById.get(id)?.inputs ?? []) {
      if (stepById.has(input) && visit(input, [...trail, id])) return true;
    }
    state.set(id, 2);
    return false;
  };
  let hasCycle = false;
  for (const s of recipe.steps) if (!hasCycle) hasCycle = visit(s.id, []);
  if (roots.length === 0 && !hasCycle && recipe.steps.length > 0)
    err("/steps", "no_root", "Every step is used by another step, so there is no final step.");

  return errors.length > 0 ? { ok: false, errors } : { ok: true, recipe, errors: [] };
}
