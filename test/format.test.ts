import { describe, expect, it } from "vitest";
import { formatAmount, formatDuration, formatQuantity, scaleRecipe } from "../src/core";
import { example } from "./helpers";

describe("formatting", () => {
  it("uses fractions for spoons and cups, decimals for metric", () => {
    expect(formatAmount(0.5, "tsp", "en-US")).toBe("½");
    expect(formatAmount(1.5, "cup", "en-US")).toBe("1½");
    expect(formatAmount(0.333, "cup", "en-US")).toBe("⅓");
    expect(formatAmount(2.5, "g", "en-US")).toBe("2.5");
    expect(formatAmount(2.5, "g", "de-DE")).toBe("2,5");
    expect(formatAmount(347, "g", "en-US")).toBe("345");
  });

  it("formats units, plurals, ranges and alternatives", () => {
    expect(formatQuantity({ value: 0.5, unit: "cup", alt: [{ value: 115, unit: "g" }] }, { locale: "en-US" })).toBe("½ cup / 115 g");
    expect(formatQuantity({ value: 2, unit: "cup" })).toBe("2 cups");
    expect(formatQuantity({ value: [1, 2], unit: "tsp" })).toBe("1–2 tsp");
    expect(formatQuantity({ value: 3 })).toBe("3");
    expect(formatQuantity({ value: 3, unit: "piece" })).toBe("3");
    expect(formatQuantity({ value: 2, unit: "cup" }, { unitLabels: { cup: ["Tasse", "Tassen"] } })).toBe("2 Tassen");
  });

  it("formats ISO durations", () => {
    expect(formatDuration("PT1H15M")).toBe("1 h 15 min");
    expect(formatDuration("PT45S")).toBe("45 s");
    expect(formatDuration("nonsense")).toBe("nonsense");
  });

  it("scales quantities and yield but not unscalable amounts", () => {
    const scaled = scaleRecipe(example("mapo-tofu"), 2);
    expect(scaled.yield?.amount).toBe(8);
    expect(scaled.ingredients.find((i) => i.id === "tofu")!.quantity!.value).toBe(800);
    expect(scaled.ingredients.find((i) => i.id === "salt")!.quantity!.value).toBe(1);
    expect(scaled.ingredients.find((i) => i.id === "chili")!.quantity!.value).toEqual([2, 4]);
  });
});
