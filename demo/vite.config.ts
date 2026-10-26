import react from "@vitejs/plugin-react";
import { resolve } from "node:path";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react()],
  base: "./",
  build: {
    rolldownOptions: {
      input: { react: resolve(__dirname, "index.html"), element: resolve(__dirname, "element.html") },
    },
  },
});
