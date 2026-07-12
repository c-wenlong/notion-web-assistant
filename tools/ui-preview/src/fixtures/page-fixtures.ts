// Fake-page fixtures for the preview. Each one simulates active-tab data:
//   - `url` is the active tab URL
//   - `selection` is the user's highlighted text (or empty if none)
//
// Pick from the dropdown to flip the preview's state; populate free-form
// fields from the URL / selection inputs in PageControls.

export interface PageFixture {
  id: string;
  label: string;
  url: string;
  /** When null, the popup is treated as if no text is selected. */
  selection: string | null;
}

export const defaultFixture: PageFixture = {
  id: "arxiv",
  label: "arXiv abstract",
  url: "https://arxiv.org/abs/2401.01234",
  selection:
    "We propose a new sparse-attention mechanism that scales linearly with sequence length. Empirically, our approach matches dense attention on language modeling while being 3\u00d7 faster at 8K context.",
};

export const pageFixtures: ReadonlyArray<PageFixture> = [
  defaultFixture,
  {
    id: "amazon-book",
    label: "Amazon book",
    url: "https://www.amazon.com/dp/0132350882",
    selection: null,
  },
  {
    id: "hn-thread",
    label: "Hacker News thread",
    url: "https://news.ycombinator.com/item?id=40000001",
    selection:
      "The closest analog is NY Times v. Sullivan, but the standing requirement in modern Section 230 jurisprudence sits on a different constitutional axis entirely.",
  },
  {
    id: "person",
    label: "Personal page",
    url: "https://example.com/jane-doe",
    selection: "Jane Doe is the CEO of ExampleCo, where she leads the data-platform org.",
  },
];
