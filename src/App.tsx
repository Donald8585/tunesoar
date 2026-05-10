import { useState, useEffect } from "react";
import { TrayWindow } from "./components/TrayWindow";
import { Settings } from "./components/Settings";
import { ContextMappings } from "./components/ContextMappings";
import { Upgrade } from "./components/Upgrade";
import { SafetyWarning } from "./components/SafetyWarning";
import { Onboarding } from "./components/Onboarding";
import { BreakNotice } from "./components/BreakNotice";
import { Account } from "./components/Account";
import { ErrorToastContainer } from "./components/ErrorToast";
import { invoke } from "@tauri-apps/api/core";

type Page = "tray" | "settings" | "mappings" | "upgrade" | "account";

function App() {
  const [page, setPage] = useState<Page>("tray");
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [showBreak, setShowBreak] = useState(false);
  const [safetyDone, setSafetyDone] = useState(false);

  // Check if onboarding has been completed
  useEffect(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    invoke<string>("get_prefs").then((prefs: any) => {
      if (!prefs?.onboarding_completed) {
        setShowOnboarding(true);
      }
    }).catch(() => {});
  }, []);

  // Listen for hash changes from TrayWindow navigation links
  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash.replace("#/", "");
      const validPages: Page[] = ["tray", "settings", "mappings", "upgrade", "account"];
      if (validPages.includes(hash as Page)) {
        setPage(hash as Page);
      }
    };
    // Handle initial hash on load
    handleHashChange();
    window.addEventListener("hashchange", handleHashChange);
    return () => window.removeEventListener("hashchange", handleHashChange);
  }, []);

  // Listen for break-required event from backend
  useEffect(() => {
    const unlisten = import("@tauri-apps/api/event").then(({ listen }) =>
      listen("break-required", () => {
        setShowBreak(true);
      })
    );
    return () => { unlisten.then(fn => fn()); };
  }, []);

  const handleSafetyComplete = () => setSafetyDone(true);
  const handleOnboardingComplete = () => setShowOnboarding(false);

  return (
    <>
      <ErrorToastContainer />
      {/* Safety gate always shows first, blocks everything */}
      {!safetyDone && <SafetyWarning onComplete={handleSafetyComplete} />}

      {/* Onboarding shows after safety */}
      {showOnboarding && <Onboarding onComplete={handleOnboardingComplete} />}

      {/* Break notice */}
      {showBreak && <BreakNotice onDismiss={() => setShowBreak(false)} />}

      {/* Main UI (only visible after safety + onboarding) */}
      {safetyDone && !showOnboarding && (
        <>
          {page === "tray" && <TrayWindow />}
          {page === "settings" && (
            <Settings
              onBack={() => { setPage("tray"); window.location.hash = ""; }}
            />
          )}
          {page === "mappings" && (
            <ContextMappings
              onBack={() => { setPage("tray"); window.location.hash = ""; }}
            />
          )}
          {page === "upgrade" && (
            <Upgrade
              onBack={() => { setPage("tray"); window.location.hash = ""; }}
            />
          )}
          {page === "account" && (
            <Account
              onBack={() => { setPage("tray"); window.location.hash = ""; }}
            />
          )}
        </>
      )}
    </>
  );
}

export default App;
