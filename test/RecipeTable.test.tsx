import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { RecipeTable, type Recipe } from "../src";
import { example, invalidExamples } from "./helpers";

afterEach(cleanup);

describe("<RecipeTable>", () => {
  it("renders an accessible table with merged step cells", () => {
    render(<RecipeTable recipe={example("pancakes")} locale="en-US" />);
    const table = screen.getByRole("table", { name: "Pancakes" });
    const rowHeaders = within(table).getAllByRole("rowheader");
    expect(rowHeaders.map((h) => h.textContent)).toEqual([
      "2 cups / 250 g flour",
      "2 tbsp sugar",
      "2 tsp baking powder",
      "½ tsp salt",
      "2 eggs",
      "1½ cups / 360 ml milk",
      "3 tbsp butter, melted",
    ]);
    const fold = within(table).getByText("fold together").closest("td")!;
    expect(fold.rowSpan).toBe(7);
    expect(fold.getAttribute("headers")!.split(" ")).toHaveLength(7);
    expect(fold.dataset.depth).toBe("2");
    const cook = within(table).getByText("cook").closest("td")!;
    expect(cook.dataset.root).toBe("true");
    expect(cook.className).toContain("rt-step-root");
  });

  it("renders a step list in cooking order", () => {
    render(<RecipeTable recipe={example("pancakes")} locale="en-US" />);
    const list = screen.getByRole("list", { name: "Steps" });
    const items = within(list).getAllByRole("listitem").map((li) => li.textContent);
    expect(items[0]).toBe("whisk: 2 cups / 250 g flour, 2 tbsp sugar, 2 tsp baking powder, ½ tsp salt");
    expect(items[2]).toBe("fold together: result of step 1, result of step 2 a few lumps are fine");
  });

  it("renders header, prep and colSpan for stretched ingredients", () => {
    const { container } = render(<RecipeTable recipe={example("mapo-tofu")} headingLevel={3} />);
    expect(screen.getByRole("heading", { level: 3, name: "Mapo Tofu" })).toBeTruthy();
    expect(screen.getByText("4 servings · Total time 30 min")).toBeTruthy();
    expect(within(screen.getByRole("list", { name: "Before you start" })).getAllByRole("listitem")).toHaveLength(1);
    const stock = screen.getByText("chicken stock").closest("th")!;
    expect(stock.colSpan).toBe(3);
    expect(container.querySelector(".rt-root")!.getAttribute("data-view")).toBe("auto");
  });

  it("scales", () => {
    render(<RecipeTable recipe={example("mapo-tofu")} scale={2} />);
    expect(screen.getByText("800 g")).toBeTruthy();
    expect(screen.getByText(/^8 servings/)).toBeTruthy();
  });

  it("applies className, classNames and style tokens", () => {
    const { container } = render(
      <RecipeTable
        recipe={example("pancakes")}
        className="mine"
        classNames={{ step: "bg-amber-100", stepMeta: "x" }}
        style={{ "--rt-color-accent": "teal" }}
      />,
    );
    const root = container.querySelector(".rt-root") as HTMLElement;
    expect(root.className).toBe("rt-root mine");
    expect(root.style.getPropertyValue("--rt-color-accent")).toBe("teal");
    expect(container.querySelectorAll(".rt-step.bg-amber-100")).toHaveLength(4);
  });

  it("shows source credit", () => {
    const recipe: Recipe = { ...example("pancakes"), source: { name: "Example Kitchen", url: "https://example.com/pancakes", author: "A. Cook" } };
    render(<RecipeTable recipe={recipe} />);
    const link = screen.getByRole("link", { name: "Example Kitchen" });
    expect(link.getAttribute("href")).toBe("https://example.com/pancakes");
    expect(link.parentElement!.textContent).toBe("Source: Example Kitchen by A. Cook");
  });

  it("renders errors instead of a wrong table and reports them once", () => {
    const onError = vi.fn();
    const data = invalidExamples.find((e) => e.code === "multiple_roots")!.data as Recipe;
    const { rerender } = render(<RecipeTable recipe={data} onError={(e) => onError(e)} />);
    rerender(<RecipeTable recipe={data} onError={(e) => onError(e)} />);
    expect(screen.queryByRole("table")).toBeNull();
    expect(screen.getByRole("alert").textContent).toContain("Several steps are not used by any later step");
    expect(onError).toHaveBeenCalledTimes(1);
    expect(onError.mock.calls[0]![0][0].code).toBe("multiple_roots");
  });
});
