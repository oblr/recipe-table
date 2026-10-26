import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import ts from "typescript";
import { afterEach, describe, expect, it } from "vitest";
import manifest from "../custom-elements.json";
import pkg from "../package.json";
import { defineRecipeTable, RecipeTableElement } from "../src/element";
import { validateRecipe } from "../src/core";

// AGENTS.md promises that everything in it is checked by these tests. So are llms.txt and README.

const root = join(__dirname, "..");
const read = (file: string) => readFileSync(join(root, file), "utf8");
const agents = read("AGENTS.md");
const readme = read("README.md");
const llms = read("llms.txt");

const fences = (md: string) => [...md.matchAll(/^```(\w*)\n([\s\S]*?)^```/gm)].map((m) => ({ lang: m[1]!, code: m[2]! }));
const ticked = (text: string) =>
  [...text.replace(/^```[\s\S]*?^```/gm, "").matchAll(/`([^`]+)`/g)].map((m) => m[1]!);
/** The markdown section under `## <heading>`, up to the next `## `. */
const section = (md: string, heading: string) => {
  const start = md.indexOf(`\n## ${heading}`);
  if (start < 0) throw new Error(`no section "${heading}"`);
  const end = md.indexOf("\n## ", start + 1);
  return md.slice(start, end < 0 ? undefined : end);
};
/** The backticked names in the line that starts with `label` (lines may wrap). */
const listAfter = (md: string, label: string) => {
  const at = md.indexOf(label);
  if (at < 0) throw new Error(`no "${label}"`);
  const sentence = md.slice(at + label.length, md.indexOf(".", md.indexOf("`", at + label.length) + 1) + 1);
  return ticked(sentence.replace(/\s+/g, " ")).map((s) => s.replace(/ \(.*$/, ""));
};

// One TypeScript program over every ts/tsx fence, resolving "recipe-table" to the sources. The
// fences are placed in examples/ so that `import recipe from "./pancakes.json"` resolves.
function typecheck(blocks: { name: string; code: string; lang: string }[]) {
  const config = ts.parseJsonConfigFileContent(ts.readConfigFile(join(root, "tsconfig.json"), ts.sys.readFile).config, ts.sys, root);
  const options: ts.CompilerOptions = {
    ...config.options,
    baseUrl: root,
    paths: {
      "recipe-table": ["src/index.ts"],
      "recipe-table/core": ["src/core.ts"],
      "recipe-table/element": ["src/element.ts"],
    },
  };
  const files = new Map(blocks.map((b) => [join(root, "examples", `${b.name}.${b.lang}`), `${b.code}\nexport {};\n`]));
  const host = ts.createCompilerHost(options);
  const { fileExists, readFile, getSourceFile } = host;
  host.fileExists = (f) => files.has(f) || fileExists(f);
  host.readFile = (f) => files.get(f) ?? readFile(f);
  host.getSourceFile = (f, lang, ...rest) =>
    files.has(f) ? ts.createSourceFile(f, files.get(f)!, lang, true) : getSourceFile(f, lang, ...rest);
  const program = ts.createProgram([...files.keys()], options, host);
  return [...files.keys()].flatMap((f) =>
    ts.getPreEmitDiagnostics(program, program.getSourceFile(f)).map(
      (d) => `${f.slice(root.length + 1)}: ${ts.flattenDiagnosticMessageText(d.messageText, "\n")}`,
    ),
  );
}

describe("AGENTS.md", () => {
  afterEach(() => document.body.replaceChildren());

  it("has code samples that typecheck against the package", () => {
    const blocks = fences(agents)
      .filter((f) => f.lang === "ts" || f.lang === "tsx")
      .map((f, i) => ({ ...f, name: `__agents_${i}` }));
    expect(blocks.length).toBeGreaterThan(0);
    expect(typecheck(blocks)).toEqual([]);
  }, 30_000);

  it("has HTML samples that render a valid recipe", () => {
    const blocks = fences(agents).filter((f) => f.lang === "html");
    expect(blocks.length).toBeGreaterThan(0);
    defineRecipeTable();
    for (const { code } of blocks) {
      document.body.innerHTML = code; // inline scripts do not run; the element does
      const tables = [...document.querySelectorAll("recipe-table")];
      expect(tables.length).toBeGreaterThan(0);
      for (const el of tables) {
        if (el.recipe === undefined) continue; // set from script in the sample
        expect(validateRecipe(el.recipe).errors).toEqual([]);
        expect(el.querySelector("table")).toBeTruthy();
      }
    }
  });

  it("lists every RecipeTable prop", () => {
    const source = read("src/react/RecipeTable.tsx");
    const body = /export interface RecipeTableProps \{([\s\S]*?)\n\}/.exec(source)![1]!;
    const props = [...body.matchAll(/^ {2}(\w+)\??:/gm)].map((m) => m[1]!);
    expect(new Set(["recipe", ...listAfter(agents, "Other props:")])).toEqual(new Set(props));
  });

  it("lists every error code, and examples/invalid only uses listed codes", () => {
    const source = read("src/core/validate.ts");
    const union = /export type ValidationCode =([\s\S]*?);/.exec(source)![1]!;
    const codes = [...union.matchAll(/"(\w+)"/g)].map((m) => m[1]!);
    const listed = /`code` values are stable: ([\s\S]*?)\./.exec(agents)![1]!.split(/,\s*/);
    expect(new Set(listed)).toEqual(new Set(codes));
    const invalid = readdirSync(join(root, "examples", "invalid")).map((f) => f.replace(".json", ""));
    for (const code of invalid) expect(codes).toContain(code);
  });

  it("lists the element's attributes and properties", () => {
    const el = section(agents, "Render without React");
    expect(listAfter(el, "Attributes:")).toEqual(RecipeTableElement.observedAttributes);
    const propertyOnly = manifest.modules[0]!.declarations[0]!.members!.filter((m) => !("attribute" in m)).map((m) => m.name);
    expect(new Set(listAfter(el, "Properties only:"))).toEqual(new Set(propertyOnly));
    expect(el).toContain(manifest.modules[0]!.declarations[0]!.events![0]!.name);
  });

  it("only names CLI commands and flags that exist", () => {
    const usage = /const USAGE = `([\s\S]*?)`/.exec(read("src/cli.ts"))![1]!;
    for (const { code } of fences(agents).filter((f) => f.lang === "sh")) {
      for (const [, command, args] of code.matchAll(/npx recipe-table (\w+)(.*)/g)) {
        expect(usage).toContain(`recipe-table ${command}`);
        for (const flag of args!.match(/--[\w-]+/g) ?? []) expect(usage).toContain(flag);
      }
    }
  });

  it("only points to files the package ships", () => {
    const paths = ticked(agents).filter((t) => /^[\w./*-]+\.(json|ts|css|md)$/.test(t) && !t.startsWith(".") && !t.startsWith("node_modules/"));
    expect(paths.length).toBeGreaterThan(5);
    for (const p of paths) expectShipped(p);
  });
});

describe("llms.txt", () => {
  it("only links to files the package ships", () => {
    const links = [...llms.matchAll(/\]\(([^)]+)\)/g)].map((m) => m[1]!);
    expect(links.length).toBeGreaterThan(0);
    for (const link of links) expectShipped(link);
  });
});

describe("README.md", () => {
  it("documents every RecipeTable prop in the props table", () => {
    const table = section(readme, "Use");
    const documented = [...table.matchAll(/^\| (.+?) \|/gm)].flatMap((m) => ticked(m[1]!));
    const source = read("src/react/RecipeTable.tsx");
    const body = /export interface RecipeTableProps \{([\s\S]*?)\n\}/.exec(source)![1]!;
    expect(new Set(documented)).toEqual(new Set([...body.matchAll(/^ {2}(\w+)\??:/gm)].map((m) => m[1]!)));
  });
});

/** In package.json "files", and present on disk (dist/ only exists after a build, so it is skipped). */
function expectShipped(path: string) {
  const clean = path.replace(/^\.\//, "").replace(/\/$/, "");
  const top = clean.split("/")[0]!;
  expect(pkg.files, `${path} is not in package.json files`).toContain(top);
  if (top === "dist") return;
  const onDisk = clean.includes("*") ? clean.slice(0, clean.lastIndexOf("/")) : clean;
  expect(existsSync(join(root, onDisk)), `${path} does not exist`).toBe(true);
}
