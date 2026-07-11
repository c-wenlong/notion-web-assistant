// Top-level Options page router (spec §6.1). Composes three cards in a
// single scrolling tab:
//
//   - AuthCard       — Notion integration token paste + workspace hint view
//   - AIProviderCard — provider picker + per-provider BYOK key field
//   - AdvancedCard   — privacy toggle + auth-mode notice
//
// No path-level routing needed for MVP: every section the spec requires is
// in scope on first load, and concierge flows (e.g. "import config DB")
// land as additional cards in Phase 1.5.

import AuthCard from "./components/AuthCard";
import AIProviderCard from "./components/AIProviderCard";
import AdvancedCard from "./components/AdvancedCard";

export default function App() {
  return (
    <div className="nc-opt">
      <header className="nc-opt__head">
        <div className="nc-opt__brand" aria-hidden="true">
          <span className="nc-opt__logo">✦</span>
          <h1 className="nc-opt__title">Nova Clipper</h1>
        </div>
        <p className="nc-opt__sub">
          Settings — synced across your devices, secrets stay on this one.
        </p>
      </header>

      <main className="nc-opt__main">
        <AuthCard />
        <AIProviderCard />
        <AdvancedCard />
      </main>

      <footer className="nc-opt__foot">
        <span className="nc-opt__foot-line">
          All credentials are stored locally. See the{" "}
          <a
            href="https://github.com/your-org/notion-web-clipper#readme"
            target="_blank"
            rel="noreferrer noopener"
          >
            privacy posture
          </a>{" "}
          for details.
        </span>
      </footer>
    </div>
  );
}
