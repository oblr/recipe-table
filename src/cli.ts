import { readFileSync } from "node:fs";
import { renderRecipeText } from "./core/text";
import { validateRecipe } from "./core/validate";

const USAGE = `Usage:
  recipe-table validate <file.json>... [--json]   Check recipes; exit code 1 if any is invalid
  recipe-table preview <file.json> [--scale N]    Print the recipe as a plain-text table`;

function load(file: string): unknown {
  try {
    return JSON.parse(readFileSync(file, "utf8"));
  } catch (e) {
    console.error(`${file}: cannot read JSON (${(e as Error).message})`);
    process.exit(2);
  }
}

const [command, ...rest] = process.argv.slice(2);
const flags = new Set(rest.filter((a) => a.startsWith("--")));
const files = rest.filter((a, i) => !a.startsWith("--") && rest[i - 1] !== "--scale");

if (command === "validate" && files.length > 0) {
  let failed = false;
  const report = files.map((file) => {
    const result = validateRecipe(load(file));
    if (!result.ok) failed = true;
    return { file, ok: result.ok, errors: result.errors };
  });
  if (flags.has("--json")) console.log(JSON.stringify(report, null, 2));
  else
    for (const { file, ok, errors } of report) {
      console.log(`${ok ? "ok  " : "FAIL"} ${file}`);
      for (const e of errors) console.log(`  ${e.path || "/"} [${e.code}] ${e.message}${e.hint ? `\n    hint: ${e.hint}` : ""}`);
    }
  process.exit(failed ? 1 : 0);
} else if (command === "preview" && files.length === 1) {
  const result = validateRecipe(load(files[0]!));
  if (!result.ok) {
    for (const e of result.errors) console.error(`${e.path || "/"} [${e.code}] ${e.message}`);
    process.exit(1);
  }
  const scaleAt = rest.indexOf("--scale");
  const scale = scaleAt >= 0 ? Number(rest[scaleAt + 1]) : 1;
  if (!(scale > 0)) {
    console.error("--scale needs a number > 0");
    process.exit(2);
  }
  console.log(renderRecipeText(result.recipe, { scale }));
} else {
  console.log(USAGE);
  process.exit(command ? 2 : 0);
}
