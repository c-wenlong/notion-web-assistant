// React 18 entrypoint for the toolbar popup. WXT's Vite dev server applies
// React Fast Refresh automatically when it sees a React render() call, so
// editing App.tsx / components hot-reloads without closing the popup.
//
// We side-effect-import the recipe handler aggregator here so the popup's
// registry is populated with all six built-in handlers from spec §4.2.1.
// Without this, `registry.list()` returns [] in the popup context because
// Vite tree-shakes each entrypoint's bundle independently — the aggregator
// (`~/core/recipes/handlers`) is otherwise only imported by the background
// service worker.

import "~/core/recipes/handlers";

import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";

const container = document.getElementById("root");
if (!container) {
  throw new Error("Nova Clipper popup: #root element not found in index.html");
}

createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
