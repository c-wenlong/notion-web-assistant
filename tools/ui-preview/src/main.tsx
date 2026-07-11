// React entrypoint for the UI preview app.
//
// We side-effect-import the parent's recipe handler aggregator so the popup's
// RecipePicker shows all six built-in handlers (otherwise Vite tree-shakes
// the aggregator out of this preview bundle). Then we render our own root
// that loads <PreviewApp />, which in turn mounts the popup's real App.

import "../../../src/core/recipes/handlers";
import "../../../src/entrypoints/popup/popup.css";
import "../../../src/entrypoints/options/options.css";
import "./styles/preview.css";

import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import PreviewApp from "./App";

const container = document.getElementById("root");
if (!container) {
  throw new Error("UI Preview: #root not found in index.html");
}

createRoot(container).render(
  <StrictMode>
    <PreviewApp />
  </StrictMode>,
);
