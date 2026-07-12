// Top-level preview app for the popup's real React tree.

import Popup from "../../../src/entrypoints/popup/App";
import { PageControls } from "./fixtures/PageControls";
import { FixtureBanner } from "./fixtures/FixtureBanner";
import { mascotUrl } from "~/shared/branding";

export default function PreviewApp() {
  return (
    <div className="preview">
      <aside className="preview__side">
        <header className="preview__brand">
          <img className="preview__mascot" src={mascotUrl} alt="" />
          <h1 className="preview__title">UI Preview</h1>
        </header>
        <p className="preview__hint">
          The real popup is on the right. These controls feed it mocked data
          so you can iterate on layouts without extension reloads.
        </p>
        <PageControls />
      </aside>

      <main className="preview__main">
        <FixtureBanner />
        <div className="preview__chrome-wrap">
          <div className="preview__chrome">
            <span className="preview__dot" aria-hidden="true" />
            <span className="preview__chrome-name">Notion Web Clipper ⸺ popup</span>
          </div>
          <div className="preview__popup">
            <Popup />
          </div>
        </div>
      </main>
    </div>
  );
}
