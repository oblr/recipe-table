import { describe, expect, it } from "vitest";
import { layoutRecipe, type GridCell } from "../src/core";
import { example } from "./helpers";

const find = (cells: GridCell[], id: string) => cells.find((c) => c.id === id)!;

describe("layoutRecipe", () => {
  it("lays out pancakes as two whisks merging", () => {
    const grid = layoutRecipe(example("pancakes"));
    const cells = [...grid.ingredients, ...grid.steps];
    expect(grid.columns).toBe(4);
    expect(grid.ingredients.map((c) => c.id)).toEqual(["flour", "sugar", "baking-powder", "salt", "eggs", "milk", "butter"]);
    expect(find(cells, "whisk-dry")).toMatchObject({ row: 0, col: 1, rowSpan: 4, colSpan: 1 });
    expect(find(cells, "whisk-wet")).toMatchObject({ row: 4, col: 1, rowSpan: 3 });
    expect(find(cells, "fold")).toMatchObject({ row: 0, col: 2, rowSpan: 7 });
    expect(find(cells, "cook")).toMatchObject({ col: 3, rowSpan: 7, isRoot: true });
    expect(grid.steps.map((s) => s.id)).toEqual(["whisk-dry", "whisk-wet", "fold", "cook"]);
  });

  it("stretches shallow inputs to the step that uses them", () => {
    const grid = layoutRecipe(example("mapo-tofu"));
    const cells = [...grid.ingredients, ...grid.steps];
    expect(find(cells, "stock")).toMatchObject({ col: 0, colSpan: 3 }); // used by simmer in column 3
    expect(find(cells, "blanch")).toMatchObject({ col: 1, colSpan: 2 });
    expect(find(cells, "slurry")).toMatchObject({ col: 1, colSpan: 3 }); // used by thicken in column 4
    expect(find(cells, "scallions")).toMatchObject({ colSpan: 5 });
    expect(find(cells, "finish")).toMatchObject({ col: 5, rowSpan: 16, isRoot: true });
  });

  it("puts every cell in the row it starts in, left to right", () => {
    const grid = layoutRecipe(example("banana-bread"));
    for (const [i, row] of grid.rows.entries()) {
      expect(row.every((c) => c.row === i)).toBe(true);
      expect(row.map((c) => c.col)).toEqual([...row.map((c) => c.col)].sort((a, b) => a - b));
    }
    // Each row is exactly covered: column spans of all cells covering a row sum to the column count.
    const cells = [...grid.ingredients, ...grid.steps];
    for (let r = 0; r < grid.rows.length; r++) {
      const covering = cells.filter((c) => c.row <= r && r < c.row + c.rowSpan);
      expect(covering.reduce((n, c) => n + c.colSpan, 0)).toBe(grid.columns);
    }
  });

  it("chains steps after the final merge", () => {
    const grid = layoutRecipe(example("banana-bread"));
    expect(grid.steps.at(-1)).toMatchObject({ id: "cool", isRoot: true });
    expect(grid.prep.map((p) => p.id)).toEqual(["preheat", "grease"]);
  });
});
