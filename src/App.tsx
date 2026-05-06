import { useState, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { TrayWindow } from "./components/TrayWindow";
import { Settings } from "./components/Settings";
import { ContextMappings } from "./components/ContextMappings";
import { Upgrade } from "./components/Upgrade";
import { SafetyWarning } from "./components/SafetyWarning";

type Page = "tray" | "settings" | "mappings" | "upgrade";

function App() {
  const [page, setPage] = useState<Page>("tray");

  // Listen for hash changes
  const handleHashChange = useCallback(() => {
    const hash = window.location.hash.replace("#/", "");
    switch (hash) {
      case "settings": setPage("settings"); break;
      case "mappings": setPage("mappings"); break;
      case "upgrade": setPage("upgrade"); break;
      default: setPage("tray");
    }
  }, []);

  // Listen for navigation events from tray menu
  useState(() => {
    window.addEventListener("hashchange", handleHashChange);
    // Initial check
    handleHashChange();
    return () => window.removeEventListener("hashchange", handleHashChange);
  });

  const getWsToken = async () => {
    return await invoke<string>("get_ws_token");
  };

  return (
    <>
      <SafetyWarning />
      {page === "tray" && <TrayWindow />}
      {page === "settings" && <Settings onBack={() => { setPage("tray"); window.location.hash = ""; }} onGetWsToken={getWsToken} />}
      {page === "mappings" && <ContextMappings onBack={() => { setPage("tray"); window.location.hash = ""; }} />}
      {page === "upgrade" && <Upgrade onBack={() => { setPage("tray"); window.location.hash = ""; }} />}
    </>
  );
}

export default App;
