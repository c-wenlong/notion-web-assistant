// Top-level preview app. Renders either the popup's real React tree (under
// a faux-Chrome 360px chrome) OR the Options page (under a wider 720px
// faux-Chrome), selectable via the tab nav at the top of the side panel.
//
// The popup's content-script fixture banner stays visible so designers can
// still see what page URL + selection the popup "would" be seeing.

import { useState } from "react";
import Popup from "../../../src/entrypoints/popup/App";
import Options from "../../../src/entrypoints/options/App";
import { PageControls } from "./fixtures/PageControls";
import { OptionsControls } from "./fixtures/OptionsControls";
import { FixtureBanner } from "./fixtures/FixtureBanner";
import { mascotUrl } from "~/shared/branding";

type ViewMode = "popup" | "options";

export default function PreviewApp() {
  const [view, setView] = useState<ViewMode>("popup");

  return (
    <div className="preview">
      <aside className="preview__side">
        <header className="preview__brand">
          <img className="preview__mascot" src={mascotUrl} alt="" />
          <h1 className="preview__title">UI Preview</h1>
        </header>
        <p className="preview__hint">
          Real popup + options components on the right; these controls feed
          them mocked data so you can iterate on layouts without extension
          reloads.
        </p>

        <div className="preview__tabs" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={view === "popup"}
            className="preview__tab"
            onClick={() => setView("popup")}
          >
            Popup
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={view === "options"}
            className="preview__tab"
            onClick={() => setView("options")}
          >
            Options
          </button>
        </div>

        {view === "popup" ? <PageControls /> : <OptionsControls />}
      </aside>

      <main className="preview__main">
        <FixtureBanner />
        {view === "popup" ? (
          <div className="preview__chrome-wrap">
            <div className="preview__chrome">
              <span className="preview__dot" aria-hidden="true" />
              <span className="preview__chrome-name">Notion Web Clipper ⸺ popup</span>
            </div>
            <div className="preview__popup">
              <Popup />
            </div>
          </div>
        ) : (
          <div className="preview__chrome-wrap preview__chrome-wrap--wide">
            <div className="preview__chrome">
              <span className="preview__dot" aria-hidden="true" />
              <span className="preview__chrome-name">
                Notion Web Clipper ⸺ chrome-extension://…/options.html
              </span>
            </div>
            <div className="preview__options">
              <Options />
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
