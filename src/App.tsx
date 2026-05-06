import { useState, useEffect, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { TrayWindow } from "./components/TrayWindow";
import { Settings } from "./components/Settings";
import { ContextMappings } from "./components/ContextMappings";
import { Upgrade } from "./components/Upgrade";
import { SafetyWarning } from "./components/SafetyWarning";
import { Onboarding } from "./components/Onboarding";
import { BreakNotice } from "./components/BreakNotice";

type Page = "tray" | "settings" | "mappings" | "upgrade";

function App() {
  const [page, setPage] = useState<Page>("tray");
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [showBreak, setShowBreak] = useState(false);
  const [safetyDone, setSafetyDone] = useState(false);

  // Check if onboarding has been completed
  useEffect(() => {
    invoke<string>("get_prefs").then((prefs: any) => {
      if (!prefs?.onboarding_completed) {
        setShowOnboarding(true);
      }
    }).catch(() => {});
  }, []);

  // Listen for break-required event from backend
  useEffect(() => {
    const unlisten = listen("break-required", () => {
      setShowBreak(true);
    });
    return () => { unlisten.then(fn => fn()); };
  }, []);

  // Listen for discomfort-stop event from tray menu
  useEffect(() => {
    const unlisten = listen("discomfort-stop", async () => {
      try {
        await invoke("discomfort_stop");
      } catch (e) {
        console.error("Discomfort stop failed:", e);
      }
      // The backend handles the 24h cooldown
    });
    return () => { unlisten.then(fn => fn()); };
  }, []);

  const handleHashChange = useCallback(() => {
    const hash = window.location.hash.replace("#/", "");
    switch (hash) {
      case "settings": setPage("settings"); break;
      case "mappings": setPage("mappings"); break;
      case "upgrade": setPage("upgrade"); break;
      default: setPage("tray");
    }
  }, []);

  useEffect(() => {
    window.addEventListener("hashchange", handleHashChange);
    handleHashChange();
    return () => window.removeEventListener("hashchange", handleHashChange);
  }, [handleHashChange]);

  const handleOnboardingComplete = async () => {
    try {
      await invoke("save_pref", { key: "onboarding_completed", value: "true" });
    } catch (e) {
      console.error("Failed to save onboarding:", e);
    }
    setShowOnboarding(false);
  };

  const handleSafetyComplete = () => {
    setSafetyDone(true);
    // Check if we need to show onboarding
    invoke<string>("get_prefs").then((prefs: any) => {
      if (!prefs?.onboarding_completed) {
        setShowOnboarding(true);
      }
    }).catch(() => {});
  };

  const getWsToken = async () => {
    return await invoke<string>("get_ws_token");
  };

  return (
    <>
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
              onGetWsToken={getWsToken}
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
        </>
      )}
    </>
  );
}

export default App;
