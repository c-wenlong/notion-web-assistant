import type { DraftValue, ReviewField } from "~/core/ai/analyze";

export type ClipperFlow =
  | { screen: "clip"; analyzing: boolean; analysisError: string | null }
  | {
      screen: "review";
      fields: ReviewField[];
      saving: boolean;
      saveError: string | null;
      savedPageUrl: string | null;
    };

export type ClipperFlowAction =
  | { type: "analysisStarted" }
  | { type: "analysisFailed"; message: string }
  | { type: "analysisReady"; fields: ReviewField[] }
  | { type: "reviewFieldChanged"; id: string; value: DraftValue }
  | { type: "approvalStarted" }
  | { type: "approvalDuplicate" }
  | { type: "approvalFailed"; message: string }
  | { type: "approvalSaved"; pageUrl: string }
  | { type: "backToClip" };

export const initialClipperFlow: ClipperFlow = {
  screen: "clip",
  analyzing: false,
  analysisError: null,
};

/** Local-only lifecycle: no Notion write occurs before approvalSaved. */
export function clipperFlowReducer(state: ClipperFlow, action: ClipperFlowAction): ClipperFlow {
  switch (action.type) {
    case "analysisStarted":
      return { screen: "clip", analyzing: true, analysisError: null };
    case "analysisFailed":
      return { screen: "clip", analyzing: false, analysisError: action.message };
    case "analysisReady":
      return {
        screen: "review",
        fields: action.fields,
        saving: false,
        saveError: null,
        savedPageUrl: null,
      };
    case "reviewFieldChanged":
      if (state.screen !== "review") return state;
      return {
        ...state,
        fields: state.fields.map((field) =>
          field.id === action.id ? { ...field, value: action.value } : field,
        ),
      };
    case "approvalStarted":
      return state.screen === "review"
        ? { ...state, saving: true, saveError: null }
        : state;
    case "approvalFailed":
      return state.screen === "review"
        ? { ...state, saving: false, saveError: action.message }
        : state;
    case "approvalDuplicate":
      return state.screen === "review" ? { ...state, saving: false } : state;
    case "approvalSaved":
      return state.screen === "review"
        ? { ...state, saving: false, savedPageUrl: action.pageUrl }
        : state;
    case "backToClip":
      return initialClipperFlow;
  }
}
