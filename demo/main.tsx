import { StrictMode, useState } from "react";
import { createRoot } from "react-dom/client";
import { RecipeTable, type Recipe } from "../src";
import "../styles.css";
import "./demo.css";
import bananaBread from "../examples/banana-bread.json";
import mapoTofu from "../examples/mapo-tofu.json";
import pancakes from "../examples/pancakes.json";
import luroufan from "../examples/vegetarian-luroufan.json";
import broken from "../examples/invalid/multiple_roots.json";

// Visual test bench: every example, both themes, all views, a few scales.
const recipes: Record<string, unknown> = {
  "Mapo Tofu": mapoTofu,
  Pancakes: pancakes,
  "Banana Bread": bananaBread,
  "Vegetarian Luroufan": luroufan,
  "Invalid (multiple roots)": broken,
};

const params = new URLSearchParams(location.search);

function Demo() {
  const [name, setName] = useState(params.get("recipe") ?? "Mapo Tofu");
  const [scale, setScale] = useState(Number(params.get("scale") ?? 1));
  const [view, setView] = useState((params.get("view") ?? "auto") as "auto" | "table" | "list");
  const [theme, setTheme] = useState(params.get("theme") ?? "system");
  const [width, setWidth] = useState(Number(params.get("width") ?? 1000));

  return (
    <div className="demo" data-theme={theme === "system" ? undefined : theme}>
      <p>
        React demo · <a href="./element.html">Web Component demo</a>
      </p>
      <form className="demo-controls" onSubmit={(e) => e.preventDefault()}>
        <label>
          Recipe
          <select value={name} onChange={(e) => setName(e.target.value)}>
            {Object.keys(recipes).map((n) => (
              <option key={n}>{n}</option>
            ))}
          </select>
        </label>
        <label>
          Scale
          <select value={scale} onChange={(e) => setScale(Number(e.target.value))}>
            {[0.5, 1, 2, 3].map((s) => (
              <option key={s} value={s}>
                {s}×
              </option>
            ))}
          </select>
        </label>
        <label>
          View
          <select value={view} onChange={(e) => setView(e.target.value as typeof view)}>
            <option>auto</option>
            <option>table</option>
            <option>list</option>
          </select>
        </label>
        <label>
          Theme
          <select value={theme} onChange={(e) => setTheme(e.target.value)}>
            <option>system</option>
            <option>light</option>
            <option>dark</option>
          </select>
        </label>
        <label>
          Width {width}px
          <input type="range" min={320} max={1400} step={20} value={width} onChange={(e) => setWidth(Number(e.target.value))} />
        </label>
      </form>
      <div className="demo-stage" style={{ maxWidth: width }}>
        <RecipeTable recipe={recipes[name] as Recipe} scale={scale} view={view} locale="en-US" />
      </div>
    </div>
  );
}

createRoot(document.getElementById("app")!).render(
  <StrictMode>
    <Demo />
  </StrictMode>,
);
