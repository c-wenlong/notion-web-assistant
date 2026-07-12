// React entrypoint for the UI preview app.

import "../../../src/entrypoints/popup/popup.css";
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
