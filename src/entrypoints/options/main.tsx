// React 18 entrypoint for the options page (spec §6.1 — the "persistent home"
// for token paste + BYOK config). 
//
// We side-effect-import the recipe handler aggregator so registry.list() is
// populated if a future cards "Add a recipe" lands here. Same rationale as
// popup/main.tsx: Vite tree-shakes each entrypoint bundle independently, so
// without this the aggregator (otherwise imported from background.ts) would
// be missing from the options bundle.

import "~/core/recipes/handlers";

import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";

const container = document.getElementById("root");
if (!container) {
  throw new Error("Nova Clipper options: #root element not found in index.html");
}

createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
