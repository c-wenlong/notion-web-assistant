// Top-level popup router. Routes between the auth gate and the main picker
// based on whether a Notion integration token is present.

import { useEffect, useState } from "react";
import { useStorageItem } from "~/storage/react";
import { notionTokenStorage, onboardingCompletedStorage, themeStorage } from "~/storage/items";
import ClipperMain from "./components/ClipperMain";
import PopupSettings from "./components/PopupSettings";

export default function App() {
  const { value: token } = useStorageItem(notionTokenStorage);
  const { value: onboardingCompleted } = useStorageItem(onboardingCompletedStorage);
  const { value: theme } = useStorageItem(themeStorage);
  const [view, setView] = useState<"clipper" | "settings">("clipper");

  useEffect(() => {
    document.documentElement.dataset.theme = theme ?? "system";
  }, [theme]);

  if (!token || !onboardingCompleted) {
    return <PopupSettings mode="onboarding" onDone={() => setView("clipper")} />;
  }

  return view === "settings" ? (
    <PopupSettings mode="settings" onDone={() => setView("clipper")} />
  ) : (
    <ClipperMain onOpenSettings={() => setView("settings")} />
  );
}
